(function () {
  'use strict';

  function getSupabaseEnabled() {
    return Boolean(window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabaseClient && typeof window.supabaseClient.from === 'function');
  }

  let applyingRemoteState = false;

  function safeJsonParse(value) {
    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  }

  function mapDocumentRow(row) {
    return {
      id: row.id,
      name: row.name,
      fileType: row.file_type || row.fileType || 'file',
      size: row.size || 0,
      sizeLabel: row.size_label || row.sizeLabel || '0 KB',
      senderName: row.sender_name || row.senderName || 'Usuário',
      senderInitials: row.sender_initials || row.senderInitials || 'U',
      ownerId: row.owner_id || row.ownerId || null,
      viewerIds: Array.isArray(row.viewer_ids) ? row.viewer_ids : [],
      sentAt: row.sent_at || row.sentAt || null,
      folder: row.folder || 'Equipe',
      messageId: row.message_id || row.messageId || null,
      url: row.url || '#',
      mimeType: row.mime_type || row.mimeType || 'application/octet-stream',
      relatedTaskId: row.related_task_id || row.relatedTaskId || null,
      relatedProjectId: row.related_project_id || row.relatedProjectId || null
    };
  }

  function mapMessageRow(row) {
    return {
      id: row.id,
      conversationId: row.conversation_id || row.conversationId || '',
      senderId: row.sender_id || row.senderId || null,
      senderName: row.sender_name || row.senderName || 'Usuário',
      text: row.text || '',
      sentAt: row.sent_at || row.sentAt || null,
      attachments: Array.isArray(row.attachments) ? row.attachments : safeJsonParse(row.attachments || '[]')
    };
  }

  function mapTaskRow(row) {
    return {
      id: row.id,
      title: row.title || 'Tarefa sem título',
      status: row.status || 'pendente',
      priority: row.priority || 'media',
      dueDate: row.due_date || row.dueDate || null,
      assignees: Array.isArray(row.assignees) ? row.assignees : safeJsonParse(row.assignees || '[]'),
      viewerIds: Array.isArray(row.viewer_ids) ? row.viewer_ids : [],
      createdBy: row.created_by || row.createdBy || null,
      completedAt: row.completed_at || row.completedAt || null,
      projectId: row.project_id || row.projectId || null,
      description: row.description || '',
      startDate: row.start_date || row.startDate || null,
      checklist: Array.isArray(row.checklist) ? row.checklist : safeJsonParse(row.checklist || '[]'),
      attachments: Array.isArray(row.attachments) ? row.attachments : safeJsonParse(row.attachments || '[]'),
      position: Number.isFinite(Number(row.position)) ? Number(row.position) : 0,
      isDemo: false,
      sector: row.sector || 'marketing',
      tags: Array.isArray(row.tags) ? row.tags : safeJsonParse(row.tags || '[]'),
      createdAt: row.created_at || row.createdAt || null,
      updatedAt: row.updated_at || row.updatedAt || row.created_at || null
    };
  }

  function mapProjectRow(row) {
    const backlogItems = Array.isArray(row.backlog_items)
      ? row.backlog_items
      : safeJsonParse(row.backlog_items || '[]');
    const attachments = Array.isArray(row.attachments) ? row.attachments : safeJsonParse(row.attachments || '[]');
    const activityLog = Array.isArray(row.activity_log) ? row.activity_log : safeJsonParse(row.activity_log || '[]');
    return {
      id: row.id,
      name: row.name || 'Projeto',
      status: row.status || 'em-andamento',
      progress: row.progress || 0,
      sector: row.sector || 'marketing',
      members: Array.isArray(row.members) ? row.members : safeJsonParse(row.members || '[]'),
      backlogItems: Array.isArray(backlogItems) ? backlogItems : [],
      description: row.description || '',
      startDate: row.start_date || null,
      endDate: row.end_date || null,
      completedAt: row.completed_at || null,
      imageUrl: row.image_url || null,
      attachments: Array.isArray(attachments) ? attachments : [],
      activityLog: Array.isArray(activityLog) ? activityLog : [],
      archived: Boolean(row.archived),
      allUsers: Boolean(row.all_users),
      createdAt: row.created_at || null,
      createdBy: row.created_by || row.createdBy || null,
      updatedAt: row.updated_at || row.updatedAt || row.created_at || null
    };
  }

  function mapProfileRow(row) {
    return {
      id: row.id,
      nickname: row.nickname || '',
      displayName: row.display_name || row.displayName || row.nickname || 'Usuário',
      role: row.role || '',
      sector: row.sector || '',
      avatarUrl: row.avatar_url || row.avatarUrl || null,
      birthday: row.birthday || '',
      personalEmail: row.personal_email || '',
      personalPhone: row.personal_phone || '',
      address: row.address || '',
      extension: row.extension || '',
      workPhone: row.work_phone || '',
      workEmail: row.work_email || '',
      enabledPanels: Array.isArray(row.enabled_panels) ? row.enabled_panels : null,
      active: row.active !== false
    };
  }

  function mapConversationRow(row) {
    return {
      id: row.id,
      name: row.name || 'Conversa',
      kind: row.kind || 'group',
      description: row.description || '',
      avatarUrl: row.avatar_url || null,
      createdBy: row.created_by || null,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || row.created_at || new Date().toISOString()
    };
  }

  function mapEventRow(row) {
    return {
      id: row.id,
      title: row.title || 'Evento',
      description: row.description || '',
      category: row.category || 'reuniao',
      startsAt: row.starts_at || row.startsAt || null,
      endsAt: row.ends_at || row.endsAt || null,
      location: row.location || '',
      createdBy: row.created_by || row.createdBy || null,
      createdAt: row.created_at || row.createdAt || new Date().toISOString(),
      updatedAt: row.updated_at || row.updatedAt || row.created_at || new Date().toISOString(),
      visibility: row.visibility || 'team',
      ownerId: row.owner_id || row.ownerId || null,
      allDay: Boolean(row.all_day || row.allDay),
      allDayStartDate: row.all_day_start_date || row.allDayStartDate || null,
      allDayEndDate: row.all_day_end_date || row.allDayEndDate || null,
      deletedAt: row.deleted_at || row.deletedAt || null,
      projectId: row.project_id || row.projectId || null
    };
  }

  function mapBusinessCardRow(row) {
    return {
      id: row.id,
      moduleKey: row.module_key,
      sector: row.sector,
      title: row.title,
      status: row.status || 'Pendente',
      data: row.data && typeof row.data === 'object' ? row.data : safeJsonParse(row.data || '{}'),
      createdBy: row.created_by || null,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
      archived: Boolean(row.archived),
      linkedTaskId: row.linked_task_id || null
    };
  }

  function mapTaskCommentRow(row) {
    return {
      id: row.id,
      taskId: row.task_id,
      attachmentId: row.attachment_id || null,
      authorId: row.author_id,
      authorName: row.author_name || 'Colaborador',
      body: row.body || '',
      attachments: Array.isArray(row.attachments) ? row.attachments : safeJsonParse(row.attachments || '[]'),
      createdAt: row.created_at || new Date().toISOString()
    };
  }

  let syncReady = Promise.resolve();

  function mapPostRow(row) {
    return {
      id: row.id,
      authorId: row.author_id || null,
      authorName: row.author_name || 'Colaborador',
      authorRole: row.author_role || '',
      type: row.post_type || 'atualizacao',
      title: row.title || '',
      body: row.body || '',
      attachments: Array.isArray(row.attachments) ? row.attachments : [],
      metadata: row.post_metadata && typeof row.post_metadata === 'object' ? row.post_metadata : {},
      createdAt: row.created_at || new Date().toISOString(),
      comments: [],
      reactions: [],
      pollVotes: []
    };
  }

  function mapPostCommentRow(row) {
    return {
      id: row.id,
      postId: row.post_id,
      authorId: row.author_id,
      body: row.body || '',
      createdAt: row.created_at || new Date().toISOString()
    };
  }

  function mapPostReactionRow(row) {
    return {
      id: row.post_id + ':' + row.user_id,
      postId: row.post_id,
      userId: row.user_id,
      reaction: row.reaction || 'like',
      createdAt: row.created_at || new Date().toISOString()
    };
  }

  function mapPostPollVoteRow(row) {
    return {
      postId: row.post_id,
      userId: row.user_id,
      optionIndex: Number(row.option_index)
    };
  }

  function mergeRemoteWithCurrent(remoteItems, currentItems) {
    const remote = Array.isArray(remoteItems) ? remoteItems : [];
    const current = Array.isArray(currentItems) ? currentItems : [];
    const remoteIds = new Set(remote.map(function (item) { return item.id; }));
    return remote.concat(current.filter(function (item) {
      return item && item.id && !remoteIds.has(item.id);
    }));
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
  }

  function projectFingerprint(project) {
    function dateValue(value) {
      if (!value) return null;
      const time = new Date(value).getTime();
      return Number.isNaN(time) ? String(value) : time;
    }
    return JSON.stringify({
      id: project.id,
      name: project.name || 'Projeto',
      status: project.status || 'em-andamento',
      progress: Number(project.progress || 0),
      sector: project.sector || 'marketing',
      members: project.members || [],
      backlogItems: project.backlogItems || [],
      description: project.description || '',
      startDate: project.startDate || null,
      endDate: project.endDate || null,
      completedAt: dateValue(project.completedAt),
      imageUrl: project.imageUrl || null,
      attachments: project.attachments || [],
      activityLog: project.activityLog || [],
      archived: Boolean(project.archived),
      allUsers: Boolean(project.allUsers),
      createdAt: dateValue(project.createdAt),
      createdBy: project.createdBy || null,
      updatedAt: dateValue(project.updatedAt)
    });
  }

  async function refreshProjectsFromSupabase() {
    if (!getSupabaseEnabled() || !window.RildonXStore) return;
    const result = await window.supabaseClient.from('projects').select('*');
    if (result.error) throw result.error;
    const currentState = window.RildonXStore.getState();
    const remote = (result.data || []).map(mapProjectRow);
    const currentRemote = (currentState.projects || []).filter(function (project) {
      return project && isUuid(project.id);
    });
    const remoteById = new Map(remote.map(function (project) { return [String(project.id), project]; }));
    const currentById = new Map(currentRemote.map(function (project) { return [String(project.id), project]; }));
    const hasChanges = remote.length !== currentRemote.length || remote.some(function (project) {
      const current = currentById.get(String(project.id));
      return !current || projectFingerprint(project) !== projectFingerprint(current);
    });
    if (!hasChanges) return;
    const localProjects = (currentState.projects || []).filter(function (project) {
      return project && !isUuid(project.id);
    });
    window.RildonXStore.setState({ projects: remote.concat(localProjects) });
  }

  function watchProjectRealtimeChanges() {
    if (!getSupabaseEnabled() || typeof window.supabaseClient.channel !== 'function') return;
    window.supabaseClient.channel('rildonx-project-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, function () {
        refreshProjectsFromSupabase().catch(function (error) {
          console.error('Não foi possível atualizar os projetos em tempo real:', error);
        });
      })
      .subscribe(function (status, error) {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('A atualização em tempo real dos projetos falhou:', error || status);
        }
      });
  }

  async function syncLocalStoreToSupabase() {
    if (!getSupabaseEnabled() || !window.RildonXStore) return;

    const state = window.RildonXStore.getState();
    const profiles = state.profiles || [];
    const authResult = await window.supabaseClient.auth.getUser();
    if (authResult.error) throw authResult.error;
    const currentUserId = authResult.data && authResult.data.user && authResult.data.user.id;
    if (!currentUserId) return;
    const msgs = state.messages || [];
    const tasks = state.tasks || [];
    const projects = state.projects || [];
    const conversations = state.conversations || [];
    const businessCardRecords = state.businessCardRecords || [];

    for (const conversation of conversations) {
      if (conversation.id === 'local-test') continue;
      const payload = {
        id: conversation.id,
        name: conversation.name,
        kind: conversation.kind,
        description: conversation.description,
        avatar_url: conversation.avatarUrl,
        created_by: isUuid(conversation.createdBy) ? conversation.createdBy : null,
        created_at: conversation.createdAt,
        updated_at: conversation.updatedAt
      };
      const { error } = await window.supabaseClient.from('conversations').upsert(payload, { onConflict: 'id' });
      if (error) console.error('Erro ao sync conversas:', error);
    }

    for (const msg of msgs) {
      if (msg.localOnly === true || !isUuid(msg.id) || msg.senderId !== currentUserId) continue;
      const payload = {
        id: msg.id,
        conversation_id: msg.conversationId,
        sender_id: isUuid(msg.senderId) ? msg.senderId : null,
        sender_name: msg.senderName,
        text: msg.text,
        sent_at: msg.sentAt,
        attachments: msg.attachments || []
      };

      const { error } = await window.supabaseClient.from('messages').upsert(payload, { onConflict: 'id' });
      if (error) console.error('Erro ao sync mensagens:', error);
    }

    for (const task of tasks) {
      if (!isUuid(task.id)) continue;
      const payload = {
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        due_date: task.dueDate,
        assignees: task.assignees || [],
        viewer_ids: Array.from(new Set((task.viewerIds || []).concat(
          profiles.filter(function (profile) {
            return (task.assignees || []).indexOf(profile.displayName || profile.nickname || profile.id) !== -1;
          }).map(function (profile) { return profile.id; }),
          isUuid(task.createdBy) ? [task.createdBy] : []
        ))),
        completed_at: task.completedAt || null,
        project_id: task.projectId,
        sector: task.sector,
        tags: task.tags || [],
        description: task.description || '',
        start_date: task.startDate || null,
        checklist: task.checklist || [],
        attachments: task.attachments || []
      };
      if (isUuid(task.createdBy)) payload.created_by = task.createdBy;

      const { error } = await window.supabaseClient.from('tasks').upsert(payload, { onConflict: 'id' });
      if (error) console.error('Erro ao sync tarefas:', error);
    }

    for (const project of projects) {
      if (!isUuid(project.id)) continue;
      const payload = {
        id: project.id,
        name: project.name,
        status: project.status,
        progress: project.progress,
        sector: project.sector,
        members: project.members || [],
        backlog_items: project.backlogItems || [],
        description: project.description || '',
        start_date: project.startDate || null,
        end_date: project.endDate || null,
        completed_at: project.completedAt || null,
        image_url: project.imageUrl || null,
        attachments: project.attachments || [],
        activity_log: project.activityLog || [],
        archived: Boolean(project.archived),
        all_users: Boolean(project.allUsers),
        created_at: project.createdAt || undefined,
        updated_at: project.updatedAt || new Date().toISOString(),
        created_by: isUuid(project.createdBy) ? project.createdBy : null
      };

      const { error } = await window.supabaseClient.from('projects').upsert(payload, { onConflict: 'id' });
      if (error) console.error('Erro ao sync projetos:', error);
    }

    for (const record of businessCardRecords) {
      if (!isUuid(record.id) || !record.moduleKey || !record.sector) continue;
      if (['purchase-parts-requests', 'hr-recruitment'].indexOf(record.moduleKey) !== -1) continue;
      const payload = {
        id: record.id,
        module_key: record.moduleKey,
        sector: record.sector,
        title: record.title,
        status: record.status || 'Pendente',
        data: record.data || {},
        archived: Boolean(record.archived),
        linked_task_id: isUuid(record.linkedTaskId) ? record.linkedTaskId : null,
        created_at: record.createdAt,
        updated_at: record.updatedAt
      };
      if (isUuid(record.createdBy)) payload.created_by = record.createdBy;
      const existing = await window.supabaseClient.from('business_card_records')
        .select('id')
        .eq('id', record.id)
        .maybeSingle();
      if (existing.error) {
        console.error('Erro ao verificar registro do card setorial:', existing.error);
        continue;
      }
      const result = existing.data
        ? await window.supabaseClient.from('business_card_records').update(payload).eq('id', record.id)
        : await window.supabaseClient.from('business_card_records').insert(payload);
      const error = result.error;
      if (error) console.error('Erro ao sincronizar registros dos cards setoriais:', error);
    }

  }

  async function hydrateFromSupabase() {
    if (!getSupabaseEnabled() || !window.RildonXStore) return;

    const authResult = await window.supabaseClient.auth.getUser();
    if (authResult.error) console.error('Erro ao identificar usuario para carregar conversas:', authResult.error);
    const currentUser = authResult.data && authResult.data.user;
    const currentUserId = currentUser ? currentUser.id : null;
    const [documentsResult, documentFoldersResult, messagesResult, tasksResult, projectsResult, profilesResult, conversationsResult, postsResult, commentsResult, reactionsResult, pollVotesResult, eventsResult, membershipResult, taskCommentsResult, businessCardRecordsResult] = await Promise.all([
      window.supabaseClient.from('documents').select('*').order('sent_at', { ascending: false }),
      window.supabaseClient.from('document_folders').select('id,name').order('name', { ascending: true }),
      window.supabaseClient.from('messages').select('*').order('sent_at', { ascending: false }),
      window.supabaseClient.from('tasks').select('*').order('created_at', { ascending: false }),
      window.supabaseClient.from('projects').select('*').order('updated_at', { ascending: false }),
      window.supabaseClient.rpc('get_rildonx_profiles'),
      window.supabaseClient.from('conversations').select('*').order('updated_at', { ascending: false }),
      window.supabaseClient.from('posts').select('*').order('created_at', { ascending: false }),
      window.supabaseClient.from('post_comments').select('*').order('created_at', { ascending: true }),
      window.supabaseClient.from('post_reactions').select('*'),
      window.supabaseClient.from('post_poll_votes').select('*'),
      window.supabaseClient.from('events').select('*').order('starts_at', { ascending: true }).limit(1000),
      currentUserId
        ?         window.supabaseClient.from('conversation_members').select('conversation_id,user_id,role,last_read_at,hidden_at')
        : Promise.resolve({ data: [], error: null }),
      window.supabaseClient.from('task_comments').select('*').order('created_at', { ascending: true }),
      window.supabaseClient.from('business_card_records').select('*').order('updated_at', { ascending: false })
    ]);

    const docError = documentsResult.error;
    const documentFoldersError = documentFoldersResult.error;
    const msgError = messagesResult.error;
    const taskError = tasksResult.error;
    const projectError = projectsResult.error;
    const profileError = profilesResult.error;
    const conversationError = conversationsResult.error;
    const postError = postsResult.error;
    const commentError = commentsResult.error;
    const reactionError = reactionsResult.error;
    const pollVotesError = pollVotesResult.error;
    const eventsError = eventsResult.error;
    const membershipError = membershipResult.error;
    const taskCommentsError = taskCommentsResult.error;
    const businessCardRecordsError = businessCardRecordsResult.error;

    if (docError) console.error('Erro ao carregar documentos do Supabase:', docError);
    if (documentFoldersError) console.error('Erro ao carregar pastas de documentos do Supabase:', documentFoldersError);
    if (msgError) console.error('Erro ao carregar mensagens do Supabase:', msgError);
    if (taskError) console.error('Erro ao carregar tarefas do Supabase:', taskError);
    if (projectError) console.error('Erro ao carregar projetos do Supabase:', projectError);
    if (profileError) console.error('Erro ao carregar perfis do Supabase:', profileError);
    if (conversationError) console.error('Erro ao carregar conversas do Supabase:', conversationError);
    if (postError) console.error('Erro ao carregar publicações do Supabase:', postError);
    if (commentError) console.error('Erro ao carregar comentários do Mural:', commentError);
    if (reactionError) console.error('Erro ao carregar reações do Mural:', reactionError);
    if (pollVotesError) console.error('Erro ao carregar votos das enquetes:', pollVotesError);
    if (eventsError) console.error('Erro ao carregar eventos do Supabase:', eventsError);
    if (membershipError) console.error('Erro ao carregar status de leitura das conversas:', membershipError);
    if (taskCommentsError) console.error('Erro ao carregar comentários das tarefas:', taskCommentsError);
    if (businessCardRecordsError) console.error('Erro ao carregar registros dos cards setoriais. Verifique se a migração supabase-business-cards.sql foi aplicada:', businessCardRecordsError);

    const currentState = window.RildonXStore.getState();
    const profileRows = (profilesResult.data || []).map(mapProfileRow).filter(function (profile) {
      return profile.active !== false;
    });
    const currentAppMetadata = currentUser && currentUser.app_metadata || {};
    const currentRole = String(currentAppMetadata.role || '').trim().toLowerCase();
    const currentLogin = String(currentUser && currentUser.email || '').split('@')[0].trim().toLowerCase();
    const currentProfile = profileRows.find(function (profile) { return profile.id === currentUserId; });
    const authenticatedUser = currentProfile
      ? Object.assign({}, currentState.user || {}, {
        id: currentUserId,
        name: currentProfile.displayName || currentProfile.nickname || 'Usuário',
        role: currentProfile.role || '',
        sector: currentProfile.sector || '',
        avatarUrl: currentProfile.avatarUrl || ''
      })
      : currentState.user;
    const isAdmin = currentAppMetadata.is_admin === true ||
      currentRole === 'admin' || currentRole === 'administrator' ||
      currentLogin === 'adson.ri' ||
      Boolean(currentProfile && String(currentProfile.nickname || '').trim().toLowerCase() === 'adson.ri');
    const profileNames = new Map(profileRows.map(function (profile) {
      return [profile.id, profile.displayName];
    }));
    const taskComments = (taskCommentsResult.data || []).map(function (row) {
      const comment = mapTaskCommentRow(row);
      comment.authorName = profileNames.get(comment.authorId) || comment.authorName;
      return comment;
    });
    const commentsByPost = new Map();
    (commentsResult.data || []).map(mapPostCommentRow).forEach(function (comment) {
      comment.authorName = profileNames.get(comment.authorId) || 'Colaborador';
      if (!commentsByPost.has(comment.postId)) commentsByPost.set(comment.postId, []);
      commentsByPost.get(comment.postId).push(comment);
    });
    const reactionsByPost = new Map();
    (reactionsResult.data || []).map(mapPostReactionRow).forEach(function (reaction) {
      if (!reactionsByPost.has(reaction.postId)) reactionsByPost.set(reaction.postId, []);
      reactionsByPost.get(reaction.postId).push(reaction);
    });
    const pollVotesByPost = new Map();
    (pollVotesResult.data || []).map(mapPostPollVoteRow).forEach(function (vote) {
      vote.authorName = profileNames.get(vote.userId) || 'Colaborador';
      if (!pollVotesByPost.has(vote.postId)) pollVotesByPost.set(vote.postId, []);
      pollVotesByPost.get(vote.postId).push(vote);
    });
    const pollResultEntries = await Promise.all((postsResult.data || []).filter(function(row) {
      return row.post_type === 'enquete';
    }).map(async function(row) {
      const result = await window.supabaseClient.rpc('get_post_poll_results', { p_post_id: row.id });
      if (result.error) {
        console.error('Erro ao carregar resultados da enquete:', result.error);
        return [row.id, []];
      }
      return [row.id, result.data || []];
    }));
    const pollResultsByPost = new Map(pollResultEntries);
    const remotePosts = (postsResult.data || []).map(function (row) {
      const post = mapPostRow(row);
      post.authorName = post.authorName === 'Colaborador'
        ? profileNames.get(post.authorId) || post.authorName
        : post.authorName;
      post.comments = commentsByPost.get(post.id) || [];
      post.reactions = reactionsByPost.get(post.id) || [];
      post.pollVotes = pollVotesByPost.get(post.id) || [];
      post.pollResults = pollResultsByPost.get(post.id) || [];
      return post;
    });
    const nextState = {
      ...currentState,
      user: authenticatedUser,
      documents: (documentsResult.data || []).map(mapDocumentRow),
      documentFolders: (documentFoldersResult.data || []).map(function (folder) {
        return { id: folder.id, name: folder.name };
      }),
      messages: (messagesResult.data || []).map(mapMessageRow),
      tasks: (tasksResult.data || []).map(mapTaskRow),
      taskComments: taskComments,
      projects: (projectsResult.data || []).map(mapProjectRow),
      profiles: profileRows,
      conversations: (conversationsResult.data || []).map(mapConversationRow),
      visibleConversationIds: isAdmin
        ? (conversationsResult.data || []).map(function (row) { return row.id; })
        : Array.from(new Set((membershipResult.data || [])
          .filter(function (row) {
            return row.user_id === currentUserId && !row.hidden_at;
          })
          .map(function (row) { return row.conversation_id; }))),
      conversationReads: (membershipResult.data || []).filter(function(row) {
        return row.user_id === currentUserId;
      }).map(function (row) {
        return {
          conversationId: row.conversation_id,
          userId: row.user_id,
          role: row.role || 'member',
          lastReadAt: row.last_read_at || null,
          hiddenAt: row.hidden_at || null
        };
      }),
      conversationMemberships: (membershipResult.data || []).map(function (row) {
        return {
          conversationId: row.conversation_id,
          userId: row.user_id,
          role: row.role || 'member',
          lastReadAt: row.last_read_at || null,
          hiddenAt: row.hidden_at || null
        };
      }),
      events: mergeRemoteWithCurrent(
        (eventsResult.data || []).map(mapEventRow),
        currentState.events
      ).filter(function (event) {
        return event.visibility !== 'private' || event.ownerId === currentUserId;
      }),
      posts: mergeRemoteWithCurrent(remotePosts, currentState.posts),
      businessCardRecords: businessCardRecordsError
        ? []
        : (businessCardRecordsResult.data || []).map(mapBusinessCardRow),
      businessCardRecordsLoadError: businessCardRecordsError
        ? 'Não foi possível carregar os cards setoriais. Verifique se a migração do Supabase foi aplicada e se seu perfil tem acesso ao setor.'
        : '',
      muralLoadError: postError || commentError || reactionError
        ? 'Não foi possível carregar todas as interações do Mural. Verifique se a migração do Mural foi aplicada no Supabase.'
        : ''
    };

    applyingRemoteState = true;
    try {
      window.RildonXStore.setRemoteState(nextState);
    } finally {
      applyingRemoteState = false;
    }
  }

  function setProfilesFromServer(profiles) {
    if (!window.RildonXStore) return;
    const currentState = window.RildonXStore.getState();
    const currentProfile = (profiles || []).find(function (profile) {
      return currentState.user && String(profile.id) === String(currentState.user.id);
    });
    const user = currentProfile
      ? Object.assign({}, currentState.user, {
        name: currentProfile.displayName || currentProfile.nickname || 'Usuário',
        role: currentProfile.role || '',
        sector: currentProfile.sector || '',
        avatarUrl: currentProfile.avatarUrl || ''
      })
      : currentState.user;
    applyingRemoteState = true;
    try {
      window.RildonXStore.setRemoteState({ profiles: profiles, user: user });
    } finally {
      applyingRemoteState = false;
    }
  }

  async function refreshProfilesFromSupabase() {
    if (!getSupabaseEnabled() || !window.RildonXStore) {
      throw new Error('A sincronização de perfis não está disponível.');
    }
    const result = await window.supabaseClient.rpc('get_rildonx_profiles');
    if (result.error) throw result.error;
    setProfilesFromServer((result.data || []).map(mapProfileRow));
  }

  function watchSharedRealtimeChanges() {
    if (!getSupabaseEnabled() || typeof window.supabaseClient.channel !== 'function') return;
    let refreshTimer = null;
    const tables = [
      'documents', 'document_folders', 'message_attachments', 'messages', 'tasks', 'projects',
      'profiles', 'profile_private_details', 'conversations',
      'conversation_members', 'posts', 'post_comments', 'post_reactions',
      'post_poll_votes', 'events', 'task_comments', 'business_card_records'
    ];
    let channel = window.supabaseClient.channel('rildonx-shared-workspace');
    tables.forEach(function (table) {
      channel = channel.on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: table
      }, function () {
        if (refreshTimer) window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(function () {
          hydrateFromSupabase().catch(function (error) {
            console.error('Não foi possível atualizar os dados compartilhados em tempo real:', error);
          });
        }, 180);
      });
    });
    channel.subscribe(function (status, error) {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('A atualização dos dados compartilhados em tempo real falhou:', error || status);
      }
    });
  }

  async function markConversationRead(conversationId) {
    await syncReady;
    if (!conversationId || !getSupabaseEnabled() || !window.RildonXStore) return;
    const userResult = await window.supabaseClient.auth.getUser();
    if (userResult.error) throw userResult.error;
    const user = userResult.data && userResult.data.user;
    if (!user) return;
    await ensureConversationRecord(conversationId, user.id);

    const lastReadAt = new Date().toISOString();
    const updateResult = await window.supabaseClient.from('conversation_members')
      .update({ last_read_at: lastReadAt })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .select('conversation_id');
    if (updateResult.error) throw updateResult.error;
    if (!updateResult.data || !updateResult.data.length) {
      const insertResult = await window.supabaseClient.from('conversation_members').insert({
        conversation_id: conversationId,
        user_id: user.id,
        last_read_at: lastReadAt
      });
      if (insertResult.error) throw insertResult.error;
    }

    const reads = (window.RildonXStore.getState().conversationReads || [])
      .filter(function (item) { return item.conversationId !== conversationId; });
    reads.push({ conversationId: conversationId, userId: user.id, lastReadAt: lastReadAt });
    window.RildonXStore.setState({ conversationReads: reads });
  }

  async function hideConversationForUser(conversationId) {
    await syncReady;
    if (!conversationId || !getSupabaseEnabled() || !window.RildonXStore) {
      throw new Error('O serviço de conversas não está disponível.');
    }
    const userResult = await window.supabaseClient.auth.getUser();
    if (userResult.error) throw userResult.error;
    const user = userResult.data && userResult.data.user;
    if (!user) throw new Error('Sua sessão expirou. Entre novamente.');
    await ensureConversationRecord(conversationId, user.id);

    const hiddenAt = new Date().toISOString();
    const result = await window.supabaseClient.from('conversation_members').upsert({
      conversation_id: conversationId,
      user_id: user.id,
      hidden_at: hiddenAt
    }, { onConflict: 'conversation_id,user_id' });
    if (result.error) throw result.error;

    const state = window.RildonXStore.getState();
    const reads = (state.conversationReads || []).filter(function (item) {
      return item.conversationId !== conversationId;
    });
    reads.push({ conversationId: conversationId, userId: user.id, hiddenAt: hiddenAt });
    const memberships = (state.conversationMemberships || []).filter(function (item) {
      return !(item.conversationId === conversationId && item.userId === user.id);
    });
    memberships.push({ conversationId: conversationId, userId: user.id, hiddenAt: hiddenAt });
    window.RildonXStore.setState({
      conversationReads: reads,
      conversationMemberships: memberships
    });
  }

  async function ensureConversationRecord(conversationId, userId) {
    const state = window.RildonXStore.getState();
    const conversation = (state.conversations || []).find(function(item) {
      return item.id === conversationId;
    });
    const now = new Date().toISOString();
    const result = await window.supabaseClient.from('conversations').upsert({
      id: conversationId,
      name: conversation && conversation.name || (String(conversationId).indexOf('direct-') === 0 ? 'Conversa direta' : conversationId),
      kind: conversation && conversation.kind || (String(conversationId).indexOf('direct-') === 0 ? 'direct' : 'group'),
      description: conversation && conversation.description || '',
      created_by: conversation && isUuid(conversation.createdBy) ? conversation.createdBy : userId,
      created_at: conversation && conversation.createdAt || now,
      updated_at: conversation && conversation.updatedAt || now
    }, { onConflict: 'id', ignoreDuplicates: true });
    if (result.error) throw result.error;
  }

  async function refreshBusinessCardRecordsFromSupabase() {
    if (!getSupabaseEnabled() || !window.RildonXStore) return;
    const result = await window.supabaseClient.from('business_card_records').select('*').order('updated_at', { ascending: false });
    if (result.error) throw result.error;
    const remote = (result.data || []).map(mapBusinessCardRow);
    window.RildonXStore.setState({ businessCardRecords: remote, businessCardRecordsLoadError: '' });
  }

  function watchBusinessCardRealtimeChanges() {
    if (!getSupabaseEnabled() || typeof window.supabaseClient.channel !== 'function') return;
    window.supabaseClient.channel('rildonx-business-card-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_card_records' }, function () {
        refreshBusinessCardRecordsFromSupabase().catch(function (error) {
          console.error('Não foi possível atualizar os registros dos cards setoriais em tempo real:', error);
        });
      })
      .subscribe(function (status, error) {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('A atualização em tempo real dos cards setoriais falhou:', error || status);
        }
      });
  }

  async function initSupabaseSync() {
    if (!getSupabaseEnabled()) {
      console.warn('Supabase não configurado. Ignorando sincronização Cloud.');
      return;
    }

    try {
      await hydrateFromSupabase();
      watchSharedRealtimeChanges();
      syncLocalStoreToSupabase().catch(function (error) {
        console.error('Os dados foram carregados, mas a sincronização inicial dos registros locais falhou:', error);
        if (typeof window.showToast === 'function') {
          window.showToast('Os dados locais ainda não foram sincronizados. Verifique sua conexão e atualize a página.');
        }
      });
    } catch (error) {
      console.error('Falha na sincronização com Supabase:', error);
      if (error && error.name === 'TimeoutError' && typeof window.showToast === 'function') {
        window.showToast('O servidor demorou para responder. A página abrirá com os dados locais; tente atualizar em instantes.');
      }
    }
  }

  function watchStoreChanges() {
    if (!window.RildonXStore || typeof window.RildonXStore.subscribe !== 'function') return;

    var syncing = false;
    var syncPending = false;
    window.RildonXStore.subscribe(function (_, source) {
      if (!getSupabaseEnabled() || applyingRemoteState || source !== 'local') return;
      if (syncing) {
        syncPending = true;
        return;
      }
      syncing = true;
      (async function () {
        do {
          syncPending = false;
          await syncLocalStoreToSupabase();
        } while (syncPending);
      })().catch(function (error) {
        console.error('Falha ao sincronizar alteração local:', error);
      }).finally(function () {
        syncing = false;
      });
    });
  }

  window.addEventListener('DOMContentLoaded', watchStoreChanges);
  window.addEventListener('DOMContentLoaded', function () {
    syncReady = initSupabaseSync();
  });
  window.RildonXSync = {
    ready: function () { return syncReady; },
    setProfilesFromServer: setProfilesFromServer,
    refreshProfilesFromSupabase: refreshProfilesFromSupabase,
    refreshBusinessCardRecordsFromSupabase: refreshBusinessCardRecordsFromSupabase,
    markConversationRead: markConversationRead,
    hideConversationForUser: hideConversationForUser
  };
})();
