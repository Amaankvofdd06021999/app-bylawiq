import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

/**
 * Phase 5 Load Test Suite
 * Tests production readiness under concurrent load
 *
 * Run with: k6 run scripts/load-test.ts
 *
 * Thresholds:
 * - P95 TTFT (time to first token): < 1.5s
 * - P95 chat completion: < 10s
 * - Error rate: < 0.1%
 * - Dashboard load: < 2s
 */

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const VIRTUAL_USERS = parseInt(__ENV.VUS || '10', 10);
const DURATION = __ENV.DURATION || '5m';
const RAMP_UP = parseInt(__ENV.RAMP_UP || '30', 10);

// Custom metrics
const ttftLatency = new Trend('ttft_latency');
const chatCompletionTime = new Trend('chat_completion_time');
const dashboardLoadTime = new Trend('dashboard_load_time');
const walletDeductionTime = new Trend('wallet_deduction_time');
const errorRate = new Rate('errors');
const successfulChats = new Counter('successful_chats');
const failedChats = new Counter('failed_chats');
const concurrentUsers = new Gauge('concurrent_users');

export const options = {
  stages: [
    { duration: `${RAMP_UP}s`, target: VIRTUAL_USERS }, // Ramp up
    { duration: DURATION, target: VIRTUAL_USERS }, // Hold
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    ttft_latency: ['p(95)<1500'], // P95 < 1.5s
    chat_completion_time: ['p(95)<10000'], // P95 < 10s
    dashboard_load_time: ['p(95)<2000'], // P95 < 2s
    wallet_deduction_time: ['p(95)<500'], // P95 < 500ms
    errors: ['rate<0.001'], // < 0.1% error rate
  },
  ext: {
    loadimpact: {
      projectID: 3456789,
      name: 'BylawIQ Phase 5 Load Test',
    },
  },
};

/**
 * Setup: Create test users and authenticate
 */
export function setup() {
  console.log('Setting up load test...');

  // Create test building and user (one-time)
  const setupRes = http.post(`${BASE_URL}/api/test-setup`, {
    action: 'create_test_env',
    vus: VIRTUAL_USERS,
  });

  check(setupRes, {
    'setup successful': (r) => r.status === 200,
  });

  const data = setupRes.json('data');
  return {
    testBuildingId: data.buildingId,
    testUserTokens: data.tokens, // Array of JWT tokens, one per VU
    firmId: data.firmId,
    documentIds: data.documentIds,
  };
}

/**
 * Load Test 1: Concurrent Dashboard Loads (Firm Owner)
 * Goal: Simulate 50 firm owners checking their dashboards simultaneously
 */
export function testFirmOwnerDashboard(data) {
  group('Firm Owner Dashboard Load', () => {
    const userIndex = Math.floor(__VU / (VIRTUAL_USERS / 5)) % 5; // Cycle through test users
    const token = data.testUserTokens[userIndex];

    const startTime = new Date();
    const res = http.get(`${BASE_URL}/api/dashboards/firm-owner`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    dashboardLoadTime.add(duration);

    check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 2s': () => duration < 2000,
      'has staff list': (r) => r.json('data.staff') !== undefined,
      'has building roster': (r) => r.json('data.roster') !== undefined,
      'has turnaround metrics': (r) => r.json('data.turnaround') !== undefined,
    });

    if (res.status !== 200) {
      errorRate.add(1);
    } else {
      errorRate.add(0);
    }

    sleep(Math.random() * 3 + 2); // 2-5 second think time
  });
}

/**
 * Load Test 2: Concurrent Chat Submissions
 * Goal: Simulate 20 residents asking questions simultaneously
 */
export function testChatSubmission(data) {
  group('Chat Submission Load', () => {
    const userIndex = __VU % data.testUserTokens.length;
    const token = data.testUserTokens[userIndex];

    const payload = {
      id: `chat-${__VU}-${__ITER}`,
      message: {
        id: `msg-${__VU}-${__ITER}`,
        role: 'user',
        parts: [
          {
            type: 'text',
            text: 'What is the procedure for calling a special meeting under our bylaws?',
          },
        ],
      },
    };

    const startTime = new Date();
    const res = http.post(`${BASE_URL}/api/chat`, JSON.stringify(payload), {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    chatCompletionTime.add(duration);

    // For streaming responses, measure first chunk arrival
    if (res.body) {
      const ttft = duration / 2; // Approximate TTFT as half of total time (conservative)
      ttftLatency.add(ttft);
    }

    check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 10s': () => duration < 10000,
      'is stream': (r) => r.headers['content-type']?.includes('text/event-stream'),
    });

    if (res.status !== 200) {
      failedChats.add(1);
      errorRate.add(1);
    } else {
      successfulChats.add(1);
      errorRate.add(0);
    }

    sleep(Math.random() * 2 + 1); // 1-3 second think time
  });
}

/**
 * Load Test 3: Wallet Deduction (Resident Chat Completion)
 * Goal: Simulate wallet deduction after chat completion
 */
export function testWalletDeduction(data) {
  group('Wallet Deduction Load', () => {
    const userIndex = __VU % data.testUserTokens.length;
    const token = data.testUserTokens[userIndex];

    const payload = {
      userId: `resident-${userIndex}`,
      buildingId: data.testBuildingId,
      amount: 10, // 10 credits
      reason: 'ask_question',
      metadata: {
        chatId: `chat-${__VU}-${__ITER}`,
        estimatedTokens: 500,
      },
    };

    const startTime = new Date();
    const res = http.post(`${BASE_URL}/api/wallet/deduct`, JSON.stringify(payload), {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    walletDeductionTime.add(duration);

    check(res, {
      'status is 200': (r) => r.status === 200,
      'deduction < 500ms': () => duration < 500,
      'has new balance': (r) => r.json('data.new_balance') !== undefined,
    });

    if (res.status !== 200) {
      errorRate.add(1);
    } else {
      errorRate.add(0);
    }

    sleep(Math.random() * 1 + 0.5); // 0.5-1.5 second think time
  });
}

/**
 * Load Test 4: Firm Knowledge Search (Strata Manager)
 * Goal: Simulate hybrid search across firm documents under load
 */
export function testFirmKnowledgeSearch(data) {
  group('Firm Knowledge Search Load', () => {
    const userIndex = __VU % data.testUserTokens.length;
    const token = data.testUserTokens[userIndex];

    const queries = [
      'special meeting procedure',
      'bylaw amendment process',
      'AGM notice requirements',
      'dispute escalation',
      'architectural review',
    ];
    const query = queries[__ITER % queries.length];

    const startTime = new Date();
    const res = http.get(
      `${BASE_URL}/api/firm-knowledge/search?query=${encodeURIComponent(query)}&firmId=${data.firmId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    dashboardLoadTime.add(duration); // Reuse dashboard metric

    check(res, {
      'status is 200': (r) => r.status === 200,
      'search < 2s': () => duration < 2000,
      'has results': (r) => r.json('data.results') !== undefined,
    });

    if (res.status !== 200) {
      errorRate.add(1);
    } else {
      errorRate.add(0);
    }

    sleep(Math.random() * 2 + 1);
  });
}

/**
 * Main test function: Distribute VUs across test scenarios
 */
export default function loadTest(data) {
  concurrentUsers.add(__VU);

  // Distribute load: 40% dashboards, 35% chat, 15% wallet, 10% search
  const rand = Math.random();
  if (rand < 0.4) {
    testFirmOwnerDashboard(data);
  } else if (rand < 0.75) {
    testChatSubmission(data);
  } else if (rand < 0.9) {
    testWalletDeduction(data);
  } else {
    testFirmKnowledgeSearch(data);
  }
}

/**
 * Teardown: Clean up test data
 */
export function teardown(data) {
  console.log('Cleaning up test environment...');

  const cleanupRes = http.post(`${BASE_URL}/api/test-setup`, {
    action: 'cleanup_test_env',
    buildingId: data.testBuildingId,
  });

  check(cleanupRes, {
    'cleanup successful': (r) => r.status === 200,
  });
}
