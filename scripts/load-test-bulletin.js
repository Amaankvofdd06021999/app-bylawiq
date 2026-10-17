/**
 * K6 Load Test: Bulletin Feature
 * Tests bulletin read/write performance under concurrent load
 *
 * Run: k6 run scripts/load-test-bulletin.js
 * Dev: k6 run --vus 10 --duration 30s scripts/load-test-bulletin.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const readDuration = new Trend('read_duration');
const writeDuration = new Trend('write_duration');
const postCount = new Gauge('post_count');
const failedRequests = new Counter('failed_requests');

// Test configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const BUILDING_ID = __ENV.BUILDING_ID || 'test-building-uuid';

export const options = {
  stages: [
    // Ramp up: 0 → 50 VUs over 2 minutes
    { duration: '2m', target: 50 },
    // Sustained: 50 VUs for 5 minutes
    { duration: '5m', target: 50 },
    // Ramp down: 50 → 0 VUs over 2 minutes
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // Read performance
    errors: ['rate<0.1'], // Less than 0.1% error rate
    failed_requests: ['count<50'], // Less than 50 failed requests total
  },
};

/**
 * Scenario 1: Read Heavy (Residents viewing bulletin)
 * 70% of load
 */
function scenarioReadBulletin() {
  group('Read Bulletin Feed', () => {
    const url = `${BASE_URL}/api/bulletin/${BUILDING_ID}/feed`;

    const params = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${__ENV.AUTH_TOKEN || 'test-token'}`,
      },
      tags: { name: 'ReadBulletin' },
    };

    const startTime = new Date();
    const response = http.get(url, params);
    const duration = new Date() - startTime;

    readDuration.add(duration);
    postCount.add(response.body ? JSON.parse(response.body).length : 0);

    check(response, {
      'status is 200': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500,
      'body contains posts': (r) => r.body.includes('title'),
    });

    if (response.status !== 200) {
      errorRate.add(1);
      failedRequests.add(1);
    } else {
      errorRate.add(0);
    }
  });

  sleep(1);
}

/**
 * Scenario 2: Write Heavy (Staff creating posts)
 * 20% of load
 */
function scenarioCreatePost() {
  group('Create Bulletin Post', () => {
    const url = `${BASE_URL}/api/bulletin/${BUILDING_ID}/create`;

    const payload = JSON.stringify({
      title: `Load Test Post ${Date.now()}`,
      body: `This is a load test post created at ${new Date().toISOString()}. Lorem ipsum dolor sit amet.`,
    });

    const params = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${__ENV.AUTH_TOKEN || 'test-token'}`,
      },
      tags: { name: 'CreatePost' },
    };

    const startTime = new Date();
    const response = http.post(url, payload, params);
    const duration = new Date() - startTime;

    writeDuration.add(duration);

    check(response, {
      'status is 201': (r) => r.status === 201,
      'response time < 1000ms': (r) => r.timings.duration < 1000,
      'body contains post ID': (r) => r.body.includes('id'),
    });

    if (response.status !== 201) {
      errorRate.add(1);
      failedRequests.add(1);
    } else {
      errorRate.add(0);
    }
  });

  sleep(2); // Slower operations, longer wait
}

/**
 * Scenario 3: Mixed Operations (Real-world usage)
 * 10% of load
 */
function scenarioMixedOperations() {
  // 80% reads
  if (Math.random() < 0.8) {
    scenarioReadBulletin();
  }
  // 20% writes
  else {
    scenarioCreatePost();
  }
}

/**
 * Main test function
 * Distributes VUs across scenarios
 */
export default function () {
  const scenario = Math.random();

  if (scenario < 0.7) {
    // 70% reads
    scenarioReadBulletin();
  } else if (scenario < 0.9) {
    // 20% writes
    scenarioCreatePost();
  } else {
    // 10% mixed
    scenarioMixedOperations();
  }
}

/**
 * Teardown: Print results summary
 */
export function teardown(data) {
  console.log('=== Bulletin Load Test Results ===');
  console.log(`Total Errors: ${failedRequests.value}`);
  console.log(`Error Rate: ${errorRate.value.toFixed(2)}%`);
}
