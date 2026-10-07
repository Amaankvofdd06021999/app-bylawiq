'use server';

import { z } from 'zod';
import { requireUser, requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { checkDb, errorMessage, NotFoundError } from '@/lib/errors';
import { getUserChatContext, type ChatContext } from './multi-role-chats';

/**
 * Create or get chat for a user based on their role
 */
export async function getOrCreateMultiRoleChatAction(raw: unknown) {
  try {
    const input = z
      .object({
        buildingId: z.string().uuid().optional(),
        title: z.string().optional(),
      })
      .parse(raw);

    const user = await requireUser();
    const db = await createClient();

    // Get user's chat context (role, building access, etc.)
    const chatContext = await getUserChatContext(user);
    if (!chatContext) {
      throw new NotFoundError('No chat access for your role');
    }

    // Verify permissions if building-scoped
    if (input.buildingId) {
      await requirePermission(user, 'chat.use', input.buildingId);
    }

    // Check for existing chat
    let buildingId = input.buildingId;
    if (chatContext.role === 'building_manager') {
      buildingId = chatContext.buildingId;
    }

    const existingQuery = db
      .from('chats')
      .select('id, title')
      .eq('user_id', user.id);

    if (buildingId) {
      existingQuery.eq('building_id', buildingId);
    }

    const { data: existing } = await existingQuery.maybeSingle();

    if (existing) {
      return {
        ok: true,
        chat: {
          id: existing.id,
          title: existing.title,
          context: chatContext,
        },
      };
    }

    // Create new chat
    const newChatId = crypto.randomUUID();
    const title = input.title || `Chat - ${new Date().toLocaleDateString()}`;

    const { error: insertError } = await db.from('chats').insert({
      id: newChatId,
      user_id: user.id,
      building_id: buildingId,
      title,
      scope: chatContext.accessLevel,
      scope_building_ids: chatContext.buildingIds,
    });

    checkDb(insertError);

    return {
      ok: true,
      chat: {
        id: newChatId,
        title,
        context: chatContext,
      },
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Send message to multi-role chat
 * Validates role permissions before sending
 */
export async function sendMultiRoleChatMessageAction(raw: unknown) {
  try {
    const input = z
      .object({
        chatId: z.string().uuid(),
        message: z.string().min(1).max(5000),
      })
      .parse(raw);

    const user = await requireUser();
    const db = await createClient();

    // Get chat
    const { data: chat, error: chatError } = await db
      .from('chats')
      .select('id, user_id, building_id, scope, scope_building_ids')
      .eq('id', input.chatId)
      .single();

    checkDb(chatError);

    if (!chat || chat.user_id !== user.id) {
      throw new NotFoundError('Chat not found or not authorized');
    }

    // Verify permissions
    if (chat.building_id) {
      await requirePermission(user, 'chat.use', chat.building_id);
    }

    if (chat.scope === 'portfolio' && chat.scope_building_ids) {
      for (const buildingId of chat.scope_building_ids) {
        await requirePermission(user, 'chat.use', buildingId);
      }
    }

    // Save message
    const messageId = crypto.randomUUID();
    const { error: messageError } = await db.from('messages').insert({
      id: messageId,
      chat_id: input.chatId,
      role: 'user',
      parts: [{ type: 'text', text: input.message }],
    });

    checkDb(messageError);

    return {
      ok: true,
      messageId,
      timestamp: new Date().toISOString(),
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Get chat history with role-aware filtering
 */
export async function getMultiRoleChatHistoryAction(raw: unknown) {
  try {
    const input = z.object({ chatId: z.string().uuid() }).parse(raw);

    const user = await requireUser();
    const db = await createClient();

    // Get chat and verify ownership
    const { data: chat, error: chatError } = await db
      .from('chats')
      .select('id, user_id, building_id, scope')
      .eq('id', input.chatId)
      .single();

    checkDb(chatError);

    if (!chat || chat.user_id !== user.id) {
      throw new NotFoundError('Chat not found');
    }

    // Get messages
    const { data: messages, error: messagesError } = await db
      .from('messages')
      .select('id, role, parts, created_at')
      .eq('chat_id', input.chatId)
      .order('created_at', { ascending: true });

    checkDb(messagesError);

    return {
      ok: true,
      messages: (messages || []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.parts
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join('\n'),
        createdAt: m.created_at,
      })),
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Export chat history (for staff users)
 */
export async function exportChatHistoryAction(raw: unknown) {
  try {
    const input = z.object({ chatId: z.string().uuid() }).parse(raw);

    const user = await requireUser();
    const db = await createClient();

    // Get chat
    const { data: chat, error: chatError } = await db
      .from('chats')
      .select('id, user_id, title, building_id')
      .eq('id', input.chatId)
      .single();

    checkDb(chatError);

    if (!chat || chat.user_id !== user.id) {
      throw new NotFoundError('Chat not found');
    }

    // Get messages
    const { data: messages } = await db
      .from('messages')
      .select('role, parts, created_at')
      .eq('chat_id', input.chatId)
      .order('created_at');

    // Format as markdown
    const markdown = [
      `# Chat: ${chat.title}`,
      `**Date:** ${new Date().toISOString()}`,
      `**Building:** ${chat.building_id || 'N/A'}`,
      '',
    ];

    for (const msg of messages || []) {
      const time = new Date(msg.created_at).toLocaleTimeString();
      const role = msg.role === 'user' ? '👤 Resident' : '🤖 Assistant';
      const text = msg.parts
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join('\n');

      markdown.push(`## ${role} (${time})`);
      markdown.push(text);
      markdown.push('');
    }

    return {
      ok: true,
      markdown: markdown.join('\n'),
      filename: `chat-${chat.id.slice(0, 8)}-${Date.now()}.md`,
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
