(function () {
  'use strict';

  const STORAGE_KEY = 'rildonx_shared_store_v1';

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function createId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return (prefix || 'record') + '-' + Date.now();
  }

  function getExtension(filename) {
    const name = String(filename || '').split('.');
    return name.length > 1 ? name[name.length - 1].toLowerCase() : 'file';
  }

  function getFileTypeLabel(filename) {
    const ext = getExtension(filename);
    const map = {
      pdf: 'PDF',
      doc: 'DOC',
      docx: 'DOC',
      xls: 'XLS',
      xlsx: 'XLS',
      ppt: 'PPT',
      pptx: 'PPT',
      png: 'IMG',
      jpg: 'IMG',
      jpeg: 'IMG',
      mp4: 'VID',
      csv: 'CSV'
    };
    return map[ext] || ext.toUpperCase();
  }

  function humanSize(size) {
    if (!size && size !== 0) return '0 KB';
    const units = ['bytes', 'KB', 'MB', 'GB'];
    let value = Number(size) || 0;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value = value / 1024;
      unitIndex += 1;
    }

    const fixed = value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1);
    return fixed + ' ' + units[unitIndex];
  }

  function buildDemoDocuments() {
    return [
      {
        id: 'doc-001',
        name: 'Briefing_Campanha_Dia_dos_Pais.pdf',
        fileType: 'pdf',
        size: 2410000,
        sizeLabel: '2.4 MB',
        senderName: 'Usuário',
        senderInitials: 'A',
        sentAt: '2026-09-18T14:37:00.000Z',
        folder: 'Equipe',
        messageId: 'msg-001',
        url: '#',
        mimeType: 'application/pdf',
        relatedTaskId: null,
        relatedProjectId: 'project-001'
      },
      {
        id: 'doc-002',
        name: 'Cronograma_Equipe_Maio.xlsx',
        fileType: 'xlsx',
        size: 48000,
        sizeLabel: '48 KB',
        senderName: 'Camila',
        senderInitials: 'C',
        sentAt: '2026-09-18T14:10:00.000Z',
        folder: 'Equipe',
        messageId: 'msg-002',
        url: '#',
        mimeType: 'application/vnd.ms-excel',
        relatedTaskId: null,
        relatedProjectId: null
      },
      {
        id: 'doc-003',
        name: 'Apresentação_Campanha_Atual.pptx',
        fileType: 'pptx',
        size: 5700000,
        sizeLabel: '5.7 MB',
        senderName: 'Mariana',
        senderInitials: 'M',
        sentAt: '2026-09-17T11:20:00.000Z',
        folder: 'Comercial',
        messageId: 'msg-003',
        url: '#',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        relatedTaskId: null,
        relatedProjectId: 'project-001'
      }
    ];
  }

  const DEFAULT_STATE = {
    user: {
      id: 'user-001',
      name: 'Usuário',
      role: 'Cargo do usuário',
      sector: 'marketing'
    },
    tasks: [
      {
        id: 'task-001',
        title: 'Revisar material da campanha',
        status: 'pendente',
        priority: 'media',
        dueDate: '2026-08-12',
        assignees: ['Usuário'],
        projectId: 'project-001',
        sector: 'marketing',
        tags: ['Campanha', 'Conteúdo'],
        isDemo: true,
        createdAt: '2026-08-08T09:00:00.000Z',
        updatedAt: '2026-08-08T09:00:00.000Z'
      },
      {
        id: 'task-002',
        title: 'Aprovar publicação do Instagram',
        status: 'pendente',
        priority: 'baixa',
        dueDate: '2026-08-13',
        assignees: ['Mariana'],
        projectId: 'project-001',
        sector: 'marketing',
        tags: ['Redes Sociais'],
        isDemo: true,
        createdAt: '2026-08-09T11:00:00.000Z',
        updatedAt: '2026-08-09T11:00:00.000Z'
      }
    ],
    projects: [
      {
        id: 'project-001',
        name: 'Campanha atual Rildon',
        status: 'em-andamento',
        progress: 75,
        sector: 'marketing',
        members: ['Usuário', 'Mariana'],
        isDemo: true,
        updatedAt: '2026-08-09T11:00:00.000Z'
      }
    ],
    profiles: [],
    taskComments: [],
    conversations: [
      { id: 'local-test', name: 'Teste local', kind: 'local', description: 'Conversa local para testes.', createdAt: nowIso(), updatedAt: nowIso() }
    ],
    documents: buildDemoDocuments(),
    businessCardRecords: [],
    messages: [],
    conversationHistoryPreserved20261016: true,
    posts: [],
    events: [],
    dashboard: {
      profile: 'colaborador',
      sector: 'marketing',
      columns: 2,
      density: 'comfortable',
      cards: [
        { id: 'card-minhas-tarefas', type: 'tarefas', title: 'Minhas tarefas', enabled: true, position: 0 },
        { id: 'card-meus-projetos', type: 'projetos', title: 'Meus projetos', enabled: true, position: 1 },
        { id: 'card-kpi-individual', type: 'indicadores', title: 'KPI individual', enabled: true, position: 2 },
        { id: 'cardagenda-dia', type: 'calendario', title: 'Agenda do dia', enabled: true, position: 3 }
      ]
    }
  };

  function readState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_STATE));
        return clone(DEFAULT_STATE);
      }
      const state = JSON.parse(raw);
      if (Array.isArray(state.events)) {
        const sharedEvents = state.events.filter(function (event) { return event.visibility !== 'private'; });
        if (sharedEvents.length !== state.events.length) {
          state.events = sharedEvents;
          writeState(state);
        }
      }
      if (!Array.isArray(state.posts)) state.posts = [];
      if (!Array.isArray(state.businessCardRecords)) state.businessCardRecords = [];
      if (!Array.isArray(state.taskComments)) state.taskComments = [];
      var changedDemoFlags = false;
      (state.tasks || []).forEach(function (task) {
        if (task && (task.id === 'task-001' || task.id === 'task-002') && task.isDemo !== true) {
          task.isDemo = true;
          changedDemoFlags = true;
        }
      });
      (state.projects || []).forEach(function (project) {
        if (project && project.id === 'project-001' && project.isDemo !== true) {
          project.isDemo = true;
          changedDemoFlags = true;
        }
      });
      if (changedDemoFlags) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (state.conversationHistoryPreserved20261016 !== true) {
        if (!Array.isArray(state.conversations)) state.conversations = [];
        if (!state.conversations.some(function(conversation) { return conversation.id === 'local-test'; })) {
          state.conversations.unshift({
            id: 'local-test',
            name: 'Teste local',
            kind: 'local',
            description: 'Conversa local para testes.',
            createdAt: nowIso(),
            updatedAt: nowIso()
          });
        }
        if (!Array.isArray(state.messages)) state.messages = [];
        state.conversationHistoryPreserved20261016 = true;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
      return state;
    } catch (error) {
      return clone(DEFAULT_STATE);
    }
  }

  function writeState(state) {
    const persistedState = Object.assign({}, state, {
      events: (state.events || []).filter(function (event) { return event.visibility !== 'private'; })
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
  }

  const store = {
    state: readState(),
    listeners: []
  };

  function notify(source) {
    store.listeners.forEach(function (listener) {
      listener(clone(store.state), source || 'local');
    });
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return function () {};
    store.listeners.push(listener);
    return function () {
      store.listeners = store.listeners.filter(function (item) {
        return item !== listener;
      });
    };
  }

  function setState(nextState) {
    store.state = Object.assign({}, store.state, nextState || {});
    writeState(store.state);
    notify();
  }

  function setRemoteState(nextState) {
    store.state = Object.assign({}, store.state, nextState || {});
    writeState(store.state);
    notify('remote');
  }

  window.addEventListener('storage', function (event) {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const nextState = JSON.parse(event.newValue);
      if (!nextState || typeof nextState !== 'object') return;
      const nextMessages = Array.isArray(nextState.messages) ? nextState.messages : [];
      const nextMessageIds = new Set(nextMessages.map(function(message) { return String(message.id); }));
      const localMessages = (store.state.messages || []).filter(function(message) {
        return message && message.localOnly === true && !nextMessageIds.has(String(message.id));
      });
      nextState.messages = nextMessages.concat(localMessages);
      store.state = Object.assign({}, store.state, nextState);
      notify('storage');
    } catch (error) {
      console.error('Não foi possível sincronizar os dados entre páginas:', error);
    }
  });

  function addTask(task) {
    const normalizedTask = Object.assign({
      id: createId('task'),
      status: 'pendente',
      priority: 'media',
      assignees: ['Usuário'],
      tags: [],
      checklist: [],
      attachments: [],
      projectId: null,
      sector: store.state.user.sector,
      position: (function () {
        const positions = (store.state.tasks || []).filter(function (item) {
          return item.status === (task && task.status || 'pendente');
        }).map(function (item) { return Number(item.position) || 0; });
        return positions.length ? Math.min.apply(Math, positions) - 1000 : 0;
      })(),
      createdAt: nowIso(),
      updatedAt: nowIso()
    }, task || {});
    const status = String(normalizedTask.status || '').toLowerCase();
    if (normalizedTask.completedAt === undefined) {
      normalizedTask.completedAt = /conclu|complete/.test(status) ? nowIso() : null;
    }

    store.state.tasks = [normalizedTask].concat(store.state.tasks || []);
    writeState(store.state);
    notify();
    return normalizedTask;
  }

  function updateTask(taskId, changes) {
    if (!taskId || !store.state.tasks) return null;

    const index = store.state.tasks.findIndex(function (task) {
      return task.id === taskId;
    });

    if (index === -1) return null;

    const currentTask = store.state.tasks[index];
    const taskChanges = Object.assign({}, changes || {});
    if (Object.prototype.hasOwnProperty.call(taskChanges, 'status') &&
        !Object.prototype.hasOwnProperty.call(taskChanges, 'completedAt')) {
      const nextStatus = String(taskChanges.status || '').toLowerCase();
      const wasCompleted = /conclu|complete/.test(String(currentTask.status || '').toLowerCase());
      const willBeCompleted = /conclu|complete/.test(nextStatus);
      taskChanges.completedAt = willBeCompleted
        ? (wasCompleted ? currentTask.completedAt || nowIso() : nowIso())
        : null;
    }
    const updated = Object.assign({}, currentTask, taskChanges, {
      updatedAt: nowIso()
    });

    store.state.tasks[index] = updated;
    writeState(store.state);
    notify();
    return updated;
  }

  function deleteTask(taskId) {
    if (!taskId || !Array.isArray(store.state.tasks)) return false;
    const index = store.state.tasks.findIndex(function (task) {
      return String(task.id) === String(taskId);
    });
    if (index < 0) return false;
    store.state.tasks.splice(index, 1);
    store.state.taskComments = (store.state.taskComments || []).filter(function (comment) {
      return String(comment.taskId) !== String(taskId);
    });
    writeState(store.state);
    notify();
    return true;
  }

  function ensureDocumentsArray() {
    if (!Array.isArray(store.state.documents)) {
      store.state.documents = [];
    }
  }

  function addDocument(documentInput) {
    ensureDocumentsArray();
    const payload = documentInput || {};
    const documentRecord = {
      id: payload.id || createId('doc'),
      name: payload.name || 'arquivo.pdf',
      fileType: payload.fileType || getFileTypeLabel(payload.name || payload.fileName || 'arquivo'),
      size: payload.size || 0,
      sizeLabel: payload.sizeLabel || humanSize(payload.size || 0),
      senderName: payload.senderName || store.state.user.name,
      senderInitials: payload.senderInitials || (payload.senderName || store.state.user.name).charAt(0).toUpperCase(),
      ownerId: payload.ownerId || null,
      viewerIds: Array.isArray(payload.viewerIds) ? payload.viewerIds : [],
      sentAt: payload.sentAt || nowIso(),
      folder: payload.folder || 'Equipe',
      messageId: payload.messageId || null,
      url: payload.url || '#',
      mimeType: payload.mimeType || 'application/octet-stream',
      relatedTaskId: payload.relatedTaskId || null,
      relatedProjectId: payload.relatedProjectId || null
    };

    const existingIndex = store.state.documents.findIndex(function (doc) {
      return doc.id === documentRecord.id;
    });

    if (existingIndex >= 0) {
      documentRecord.ownerId = payload.ownerId || store.state.documents[existingIndex].ownerId || null;
      if (!Array.isArray(payload.viewerIds)) {
        documentRecord.viewerIds = store.state.documents[existingIndex].viewerIds || [];
      }
      store.state.documents[existingIndex] = Object.assign({}, store.state.documents[existingIndex], documentRecord);
    } else {
      store.state.documents.unshift(documentRecord);
    }

    writeState(store.state);
    notify();
    return documentRecord;
  }

  function addMessage(message) {
    const normalizedMessage = Object.assign({
      id: createId('msg'),
      conversationId: 'local-test',
      senderId: store.state.user.id,
      senderName: store.state.user.name,
      text: '',
      sentAt: nowIso(),
      attachments: [],
      localOnly: true
    }, message || {});

    if (Array.isArray(normalizedMessage.attachments)) {
      normalizedMessage.attachments = normalizedMessage.attachments.map(function (attachment) {
        if (typeof attachment === 'string') return attachment;
        if (attachment && attachment.id) return attachment.id;
        return addDocument(attachment).id;
      });
    }

    store.state.messages = [normalizedMessage].concat(store.state.messages || []);
    writeState(store.state);
    notify();
    return normalizedMessage;
  }

  function addConversation(conversation) {
    const normalizedConversation = Object.assign({
      id: createId('conversation'),
      name: 'Nova conversa',
      kind: 'direct',
      description: '',
      createdAt: nowIso(),
      updatedAt: nowIso()
    }, conversation || {});

    const existingIndex = (store.state.conversations || []).findIndex(function (item) {
      return item.id === normalizedConversation.id;
    });
    if (existingIndex >= 0) {
      store.state.conversations[existingIndex] = Object.assign({}, store.state.conversations[existingIndex], normalizedConversation);
    } else {
      store.state.conversations = [normalizedConversation].concat(store.state.conversations || []);
    }
    writeState(store.state);
    notify();
    return normalizedConversation;
  }

  function addPost(post) {
    const normalizedPost = Object.assign({
      id: createId('post'),
      authorId: store.state.user.id,
      authorName: store.state.user.name,
      type: 'atualizacao',
      title: '',
      body: '',
      createdAt: nowIso(),
      comments: [],
      reactions: []
    }, post || {});

    store.state.posts = [normalizedPost].concat(store.state.posts || []);
    writeState(store.state);
    notify();
    return normalizedPost;
  }

  function addBusinessCardRecord(record) {
    const payload = record || {};
    if (!payload.moduleKey || !payload.title) throw new Error('O card e o título do registro são obrigatórios.');
    const now = nowIso();
    const normalized = {
      id: payload.id || createId('card-record'),
      moduleKey: String(payload.moduleKey),
      sector: String(payload.sector || ''),
      title: String(payload.title).trim(),
      status: String(payload.status || 'Pendente'),
      data: payload.data && typeof payload.data === 'object' ? clone(payload.data) : {},
      createdBy: payload.createdBy || store.state.user.id || null,
      createdAt: payload.createdAt || now,
      updatedAt: now,
      archived: false,
      linkedTaskId: payload.linkedTaskId || null
    };
    store.state.businessCardRecords = [normalized].concat(store.state.businessCardRecords || []);
    writeState(store.state);
    notify();
    return clone(normalized);
  }

  function updateBusinessCardRecord(recordId, changes) {
    const records = store.state.businessCardRecords || [];
    const index = records.findIndex(function (record) { return String(record.id) === String(recordId); });
    if (index < 0) return null;
    const current = records[index];
    const payload = changes || {};
    records[index] = Object.assign({}, current, payload, {
      id: current.id,
      moduleKey: current.moduleKey,
      sector: current.sector,
      createdBy: current.createdBy,
      createdAt: current.createdAt,
      updatedAt: nowIso()
    });
    writeState(store.state);
    notify();
    return clone(records[index]);
  }

  function addMessageWithDocument(data) {
    const documentRecord = addDocument(data.document);
    const messageRecord = addMessage({
      text: data.text || 'Arquivo compartilhado via mensagem.',
      senderName: data.senderName || store.state.user.name,
      senderId: data.senderId || store.state.user.id,
      conversationId: data.conversationId || 'local-test',
      attachments: [documentRecord.id]
    });

    return { documentRecord: documentRecord, messageRecord: messageRecord };
  }

  function getRecentDocuments(limit) {
    ensureDocumentsArray();
    return (store.state.documents || []).slice().sort(function (a, b) {
      return new Date(b.sentAt) - new Date(a.sentAt);
    }).slice(0, limit || 10);
  }

  function getState() {
    return clone(store.state);
  }

  window.RildonXStore = {
    getState: getState,
    setState: setState,
    setRemoteState: setRemoteState,
    subscribe: subscribe,
    addTask: addTask,
    updateTask: updateTask,
    deleteTask: deleteTask,
    addDocument: addDocument,
    addMessage: addMessage,
    addConversation: addConversation,
    addPost: addPost,
    addBusinessCardRecord: addBusinessCardRecord,
    updateBusinessCardRecord: updateBusinessCardRecord,
    addMessageWithDocument: addMessageWithDocument,
    getRecentDocuments: getRecentDocuments,
    readState: getState,
    STORAGE_KEY: STORAGE_KEY,
    cloudConfig: {
      enabled: false,
      provider: 'supabase',
      apiUrl: '',
      anonKey: ''
    }
  };
})();
