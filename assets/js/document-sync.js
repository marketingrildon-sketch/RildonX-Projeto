(function () {
  'use strict';

  var PAGE_SIZE = 10;
  var currentPage = 1;
  var documentViewMode = 'list';
  var currentFolderPage = 1;
  var FOLDER_PAGE_SIZE = 10;
  var MAX_CUSTOM_FOLDERS = 15;
  var selectedFolderName = '';
  var documentFilters = {
    search: '',
    type: '',
    owner: '',
    project: '',
    sector: '',
    dateFrom: '',
    dateTo: '',
    sort: 'recent',
    favoritesOnly: false
  };
  var favoriteDocumentIds = new Set();
  var documentPreferencesLoadedFor = '';
  var DEFAULT_FOLDERS = ['Pessoal', 'Equipe'];
  var folderNameInput;
  var currentUserId = null;
  var storageRefreshTimer = null;
  var storageRefreshInProgress = false;
  var storageRefreshPending = false;
  var supabaseClientWait;
  var documentShareContext = null;
  try {
    var savedDocumentViewMode = localStorage.getItem('rildonx_document_view_mode');
    if (savedDocumentViewMode === 'grid' || savedDocumentViewMode === 'list') documentViewMode = savedDocumentViewMode;
  } catch (error) {
    console.warn('Não foi possível restaurar a visualização dos documentos:', error);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getFilePresentation(documentItem) {
    var nameExtension = String(documentItem.name || '').split('.').pop();
    var fileType = String(documentItem.fileType || '');
    var extension = (nameExtension && nameExtension !== documentItem.name
      ? nameExtension
      : fileType.split('/').pop()).toLowerCase();
    var labels = {
      doc: 'DOC',
      docx: 'DOC',
      pdf: 'PDF',
      ppt: 'PPT',
      pptx: 'PPT',
      xls: 'XLS',
      xlsx: 'XLS',
      jpeg: 'IMG',
      jpg: 'IMG',
      png: 'IMG',
      csv: 'CSV',
      mp4: 'VID'
    };

    return {
      extension: /^[a-z0-9]+$/.test(extension) ? extension : 'file',
      label: labels[extension] || (extension ? extension.slice(0, 4).toUpperCase() : 'ARQ')
    };
  }

  function renderFileIcon(file) {
    var iconMarkup = window.RildonXFileIconMarkup && window.RildonXFileIconMarkup(file.extension);
    return iconMarkup || escapeHtml(file.label);
  }

  function getDocumentType(documentItem) {
    var presentation = getFilePresentation(documentItem);
    var extension = presentation.extension;
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'heic', 'heif', 'avif'].indexOf(extension) !== -1) return 'Imagem';
    if (['mp4', 'm4v', 'mov', 'avi', 'mkv', 'webm', 'mpeg', 'mpg', '3gp'].indexOf(extension) !== -1) return 'Vídeo';
    if (['pdf'].indexOf(extension) !== -1) return 'PDF';
    if (['doc', 'docx', 'odt', 'rtf', 'txt'].indexOf(extension) !== -1) return 'Documento';
    if (['xls', 'xlsx', 'csv', 'ods'].indexOf(extension) !== -1) return 'Planilha';
    if (['ppt', 'pptx', 'odp'].indexOf(extension) !== -1) return 'Apresentação';
    if (['zip', 'rar', '7z', 'gz'].indexOf(extension) !== -1) return 'Compactado';
    return 'Outro';
  }

  function getDocumentProject(documentItem, state) {
    var task = documentItem.relatedTaskId && (state.tasks || []).find(function (item) {
      return String(item.id) === String(documentItem.relatedTaskId);
    });
    var projectId = documentItem.relatedProjectId || task && task.projectId;
    var project = projectId && (state.projects || []).find(function (item) {
      return String(item.id) === String(projectId);
    });
    return { task: task || null, project: project || null };
  }

  function getDocumentOrigin(documentItem, state) {
    var source = getDocumentProject(documentItem, state);
    if (source.task) {
      return {
        label: source.task.title || 'Tarefa',
        href: 'tarefas.html?calendarSource=' + encodeURIComponent(source.task.id),
        type: 'Tarefa'
      };
    }
    if (source.project) {
      return {
        label: source.project.name || 'Projeto',
        href: 'projetos.html?calendarSource=' + encodeURIComponent(source.project.id),
        type: 'Projeto'
      };
    }
    if (documentItem.messageId || String(documentItem.folder || '').toLocaleLowerCase('pt-BR') === 'mensagens') {
      return { label: 'Mensagens', href: 'mensagens.html', type: 'Mensagem' };
    }
    return { label: documentItem.folder || 'Upload direto', href: '', type: 'Pasta' };
  }

  function getDocumentSector(documentItem, state) {
    var source = getDocumentProject(documentItem, state);
    var profile = getProfileById(documentItem.ownerId) || getSenderProfile(documentItem);
    return source.project && source.project.sector ||
      profile && (profile.sector || profile.department || profile.area) || '';
  }

  function getDocumentPermission(documentItem) {
    var viewers = Array.isArray(documentItem.viewerIds) ? documentItem.viewerIds.length : 0;
    return viewers ? 'Compartilhado com ' + viewers + ' pessoa' + (viewers === 1 ? '' : 's') : 'Acesso restrito';
  }

  function documentPreferenceKey() {
    return 'rildonx_document_preferences_' + (currentUserId || 'guest');
  }

  function loadDocumentPreferences() {
    var key = currentUserId || 'guest';
    if (documentPreferencesLoadedFor === key) return;
    documentPreferencesLoadedFor = key;
    try {
      var saved = JSON.parse(localStorage.getItem(documentPreferenceKey()) || '{}');
      if (!saved || typeof saved !== 'object') return;
      documentFilters.search = saved.search || '';
      documentFilters.type = saved.type || '';
      documentFilters.owner = saved.owner || '';
      documentFilters.project = saved.project || '';
      documentFilters.sector = saved.sector || '';
      documentFilters.dateFrom = saved.dateFrom || '';
      documentFilters.dateTo = saved.dateTo || '';
      documentFilters.sort = ['recent', 'oldest', 'name', 'type', 'size'].indexOf(saved.sort) !== -1 ? saved.sort : 'recent';
      documentFilters.favoritesOnly = saved.favoritesOnly === true;
      selectedFolderName = saved.folder || '';
      favoriteDocumentIds = new Set(Array.isArray(saved.favorites) ? saved.favorites.map(String) : []);
      var search = document.querySelector('[data-documents-search]');
      if (search) search.value = documentFilters.search;
    } catch (error) {
      console.warn('Não foi possível restaurar as preferências dos documentos:', error);
    }
  }

  function saveDocumentPreferences() {
    try {
      var saved = {
        search: String((document.querySelector('[data-documents-search]') || {}).value || ''),
        type: documentFilters.type,
        owner: documentFilters.owner,
        project: documentFilters.project,
        sector: documentFilters.sector,
        dateFrom: documentFilters.dateFrom,
        dateTo: documentFilters.dateTo,
        sort: documentFilters.sort,
        favoritesOnly: documentFilters.favoritesOnly,
        folder: selectedFolderName,
        favorites: Array.from(favoriteDocumentIds)
      };
      localStorage.setItem(documentPreferenceKey(), JSON.stringify(saved));
    } catch (error) {
      console.warn('Não foi possível salvar as preferências dos documentos:', error);
      showDocumentActionError('As preferências não puderam ser salvas neste navegador.');
    }
  }

  function formatDateTime(value) {
    var date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return 'Data indisponível';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  function getMessageAttachmentIds(state) {
    var ids = new Set();
    (state.messages || []).forEach(function (message) {
      (Array.isArray(message.attachments) ? message.attachments : []).forEach(function (attachment) {
        var id = typeof attachment === 'string' ? attachment : attachment && attachment.id;
        if (id) ids.add(String(id));
      });
    });
    return ids;
  }

  function isModuleOnlyFolder(folder) {
    var moduleFolders = [
      'cards setoriais',
      'gestão de documentos',
      'marketing - branding',
      'marketing - indicadores',
      'projetos',
      'tarefas'
    ];
    var normalized = String(folder || '').trim().toLocaleLowerCase('pt-BR');
    return moduleFolders.indexOf(normalized) !== -1;
  }

  function isDocumentVisible(documentItem, messageAttachmentIds) {
    var folder = String(documentItem.folder || '').trim().toLocaleLowerCase('pt-BR');
    if (folder === 'mural' || isModuleOnlyFolder(folder) || isMedicalDocument(documentItem)) return false;

    var isMessageDocument = Boolean(documentItem.messageId) ||
      messageAttachmentIds.has(String(documentItem.id)) ||
      folder.indexOf('mensagens não salvas') === 0;
    if (isMessageDocument) {
      return folder === 'mensagens';
    }

    return true;
  }

  function getDocuments() {
    if (!window.RildonXStore) return [];
    var state = window.RildonXStore.getState();
    var messageAttachmentIds = getMessageAttachmentIds(state);
    return (state.documents || []).filter(function (documentItem) {
      return isDocumentVisible(documentItem, messageAttachmentIds);
    }).slice().sort(function (first, second) {
      return new Date(second.sentAt || 0) - new Date(first.sentAt || 0);
    });
  }

  function getAllFolders() {
    var state = window.RildonXStore ? window.RildonXStore.getState() : {};
    var folderNames = DEFAULT_FOLDERS.slice();
    (state.documentFolders || []).forEach(function (folder) {
      folderNames.push(typeof folder === 'string' ? folder : folder && folder.name);
    });

    var seen = new Set();
    return folderNames.filter(function (folder) {
      var name = String(folder || '').trim();
      var normalized = name.toLocaleLowerCase('pt-BR');
      if (!name || normalized === 'mural' || normalized.indexOf('mensagens não salvas') === 0 ||
          isModuleOnlyFolder(normalized) || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }

  function getCustomFolderCount(folders) {
    var names = new Set();
    (folders || []).forEach(function (folder) {
      var name = String(typeof folder === 'string' ? folder : folder && folder.name || '').trim();
      var normalized = name.toLocaleLowerCase('pt-BR');
      var isDefault = DEFAULT_FOLDERS.some(function (defaultFolder) {
        return defaultFolder.toLocaleLowerCase('pt-BR') === normalized;
      });
      if (name && !isDefault && !isModuleOnlyFolder(normalized)) names.add(normalized);
    });
    return names.size;
  }

  function folderCounts() {
    var counts = {};
    getDocuments().forEach(function (documentItem) {
      var folder = documentItem.folder || 'Equipe';
      counts[folder] = (counts[folder] || 0) + 1;
    });
    return counts;
  }

  function getSenderProfile(documentItem) {
    if (!window.RildonXStore) return null;
    var normalizedName = String(documentItem.senderName || '').trim().toLocaleLowerCase('pt-BR');
    return (window.RildonXStore.getState().profiles || []).find(function(profile) {
      return [profile.displayName, profile.nickname].some(function(name) {
        return name && String(name).trim().toLocaleLowerCase('pt-BR') === normalizedName;
      });
    }) || null;
  }

  function getProfileById(userId) {
    if (!window.RildonXStore || !userId) return null;
    return (window.RildonXStore.getState().profiles || []).find(function(profile) {
      return profile.id === userId;
    }) || null;
  }

  function getProfileAvatarMarkup(profile, fallbackName) {
    var name = profile && (profile.displayName || profile.nickname) || fallbackName || 'Usuário';
    var initials = String(name).split(/\s+/).map(function(part) {
      return part.charAt(0);
    }).join('').slice(0, 2).toUpperCase() || 'U';
    var image = profile && window.RildonXAvatar ? window.RildonXAvatar.imageMarkup(profile) : '';
    return '<span class="document-person-avatar" title="' + escapeHtml(name) + '">' + initials + image + '</span>';
  }

  function renderDocumentPeople(documentItem, ownerProfile) {
    var ownerName = ownerProfile && (ownerProfile.displayName || ownerProfile.nickname) ||
      documentItem.senderName || 'Usuário';
    var viewerProfiles = (documentItem.viewerIds || []).map(function(userId) {
      return getProfileById(userId) || { id: userId, displayName: 'Usuário' };
    });
    var visibleProfiles = viewerProfiles.slice(0, 3);
    var extraCount = Math.max(0, viewerProfiles.length - visibleProfiles.length);
    var viewers = visibleProfiles.map(function(profile) {
      return getProfileAvatarMarkup(profile, profile.displayName || profile.nickname);
    }).join('');
    if (extraCount) viewers += '<span class="document-person-overflow" title="' +
      escapeHtml(viewerProfiles.slice(3).map(function(profile) {
        return profile.displayName || profile.nickname || 'Usuário';
      }).join(', ')) + '">+' + extraCount + '</span>';

    return '<span class="document-owner">' +
      getProfileAvatarMarkup(ownerProfile, ownerName) +
      '<span class="document-owner-name" title="' + escapeHtml(ownerName) + '">' + escapeHtml(ownerName) + '</span>' +
      (viewers ? '<span class="document-viewer-separator" aria-hidden="true">•</span><span class="document-viewer-avatars" aria-label="Visualizadores">' + viewers + '</span>' : '') +
      '</span>';
  }

  function renderFavoriteButton(documentItem) {
    var favorite = favoriteDocumentIds.has(String(documentItem.id));
    return '<button class="document-favorite-btn' + (favorite ? ' active' : '') + '" type="button" data-document-favorite="' +
      escapeHtml(documentItem.id) + '" aria-pressed="' + favorite + '" aria-label="' + (favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos') +
      '" title="' + (favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos') + '">' + (favorite ? '★' : '☆') + '</button>';
  }

  function renderDocumentMoreActions(documentItem) {
    var id = escapeHtml(documentItem.id);
    var actions = [];
    if (!isMedicalDocument(documentItem) && (window.RildonXIsAdmin || documentItem.ownerId && documentItem.ownerId === currentUserId)) {
      actions.push('<button type="button" data-document-action="share" data-document-id="' + id + '">Gerenciar acessos</button>');
    }
    if (!isMedicalDocument(documentItem) && window.RildonXDocumentUpload &&
        window.RildonXDocumentUpload.canRemoveDocument(documentItem, currentUserId)) {
      actions.push('<button type="button" class="is-destructive" data-document-action="remove" data-document-id="' + id + '">Remover arquivo</button>');
    }
    return actions.length ? '<details class="document-action-menu"><summary aria-label="Mais ações do documento">•••</summary><div>' +
      actions.join('') + '</div></details>' : '';
  }

  function renderDocumentOrigin(documentItem, state) {
    var origin = getDocumentOrigin(documentItem, state);
    var label = '<span class="document-origin-kind">' + escapeHtml(origin.type) + '</span> ' + escapeHtml(origin.label);
    return origin.href
      ? '<a class="document-origin-link" href="' + escapeHtml(origin.href) + '" aria-label="Abrir origem: ' + escapeHtml(origin.label) + '">' + label + '</a>'
      : '<span class="document-origin-link">' + label + '</span>';
  }

  function renderDocumentRow(documentItem) {
    var file = getFilePresentation(documentItem);
    var id = escapeHtml(documentItem.id);
    var state = window.RildonXStore.getState();
    var profile = getProfileById(documentItem.ownerId) || getSenderProfile(documentItem);
    var name = escapeHtml(documentItem.name || 'Arquivo sem nome');
    return [
      '<div class="doc-table-row" data-document-id="' + id + '">',
      '<div class="name-cell">',
      '    <div class="doc-icon ' + file.extension + '">' + renderFileIcon(file) + '</div>',
      '    <div class="document-name-details"><button class="document-title-link" type="button" data-document-action="open" data-document-id="' + id + '" title="Abrir ' + name + '"><b>' + name + '</b></button><span class="document-row-meta">' +
      escapeHtml(documentItem.sizeLabel || '0 KB') + ' · ' + escapeHtml(getDocumentPermission(documentItem)) + '</span></div>',
      '  </div>',
      '  <div class="date-cell"><span class="document-column-label">Modificado</span>' + escapeHtml(formatDateTime(documentItem.sentAt)) + '</div>',
      '  <div class="document-owner-cell"><span class="document-column-label">Responsável</span>' + escapeHtml(profile && (profile.displayName || profile.nickname) || documentItem.senderName || 'Usuário') + '</div>',
      '  <div class="document-origin-cell"><span class="document-column-label">Origem</span>' + renderDocumentOrigin(documentItem, state) + '</div>',
      '  <div class="document-row-actions">',
      renderFavoriteButton(documentItem),
      '    <button class="document-action-text" type="button" data-document-action="open" data-document-id="' + id + '">Abrir</button>',
      '    <button class="document-action-text" type="button" data-document-action="download" data-document-id="' + id + '">Baixar</button>',
      renderDocumentMoreActions(documentItem),
      '  </div>',
      '</div>'
    ].join('');
  }

  function renderDocumentCard(documentItem) {
    var file = getFilePresentation(documentItem);
    var id = escapeHtml(documentItem.id);
    var state = window.RildonXStore.getState();
    var profile = getProfileById(documentItem.ownerId) || getSenderProfile(documentItem);
    var name = escapeHtml(documentItem.name || 'Arquivo sem nome');
    return '<article class="document-grid-card" data-document-id="' + id + '">' +
      '<div class="document-grid-card-actions">' + renderFavoriteButton(documentItem) + renderDocumentMoreActions(documentItem) + '</div>' +
      '<button class="document-grid-open" type="button" data-document-action="open" data-document-id="' + id + '" aria-label="Abrir ' + name + '">' +
      '<span class="doc-icon ' + escapeHtml(file.extension) + '">' + renderFileIcon(file) + '</span>' +
      '<strong title="' + name + '">' + name + '</strong></button>' +
      '<div class="document-grid-meta"><span>' + escapeHtml(getDocumentType(documentItem)) + ' · ' + escapeHtml(documentItem.sizeLabel || '0 KB') + '</span>' +
      '<span>' + escapeHtml(profile && (profile.displayName || profile.nickname) || documentItem.senderName || 'Usuário') + ' · ' + escapeHtml(formatDateTime(documentItem.sentAt)) + '</span></div>' +
      '<div class="document-grid-origin">' + renderDocumentOrigin(documentItem, state) + '</div>' +
      '<span class="document-grid-permission">' + escapeHtml(getDocumentPermission(documentItem)) + '</span>' +
      '<div class="document-grid-primary-actions"><button type="button" data-document-action="open" data-document-id="' + id + '">Abrir</button>' +
      '<button type="button" data-document-action="download" data-document-id="' + id + '">Baixar</button></div></article>';
  }

  function renderPagination(total, pageCount) {
    var root = document.getElementById('documents-live-root');
    var first = total ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
    var last = Math.min(currentPage * PAGE_SIZE, total);
    var pageButtons = [];

    for (var page = 1; page <= pageCount; page += 1) {
      pageButtons.push(
        '<button class="page-btn' + (page === currentPage ? ' active' : '') + '" type="button" data-page="' + page + '" aria-label="Página ' + page + '"' +
        (page === currentPage ? ' aria-current="page"' : '') + '>' + page + '</button>'
      );
    }

    root.querySelector('.pagination').innerHTML = [
      '<div class="pagination-pages">',
      '<div class="page-btns">',
      '<button class="page-btn" type="button" data-page="' + (currentPage - 1) + '" aria-label="Página anterior"' + (currentPage <= 1 ? ' disabled' : '') + '>‹</button>',
      pageButtons.join(''),
      '<button class="page-btn" type="button" data-page="' + (currentPage + 1) + '" aria-label="Próxima página"' + (currentPage >= pageCount ? ' disabled' : '') + '>›</button>',
      '</div></div>',
      '<div class="count">Exibindo ' + first + ' a ' + last + ' de ' + total + '</div>'
    ].join('');

    root.querySelectorAll('[data-page]').forEach(function (button) {
      button.addEventListener('click', function () {
        var page = Number(button.dataset.page);
        if (page < 1 || page > pageCount || page === currentPage) return;
        currentPage = page;
        renderDocumentList();
      });
    });
  }

  function setDocumentFilterOptions(name, label, values, selected) {
    var select = document.querySelector('[data-documents-filter="' + name + '"]');
    if (!select) return;
    var options = ['<option value="">' + escapeHtml(label) + '</option>'];
    values.forEach(function (item) {
      if (!item || !item.value || !item.label) return;
      options.push('<option value="' + escapeHtml(item.value) + '"' +
        (String(item.value) === String(selected || '') ? ' selected' : '') + '>' + escapeHtml(item.label) + '</option>');
    });
    select.innerHTML = options.join('');
  }

  function updateDocumentFilterOptions(documents) {
    var state = window.RildonXStore.getState();
    var unique = function (key, labeler) {
      var seen = new Set();
      return documents.map(function (item) {
        var value = String(key(item) || '');
        if (!value || seen.has(value)) return null;
        seen.add(value);
        return { value: value, label: labeler(item, value) };
      }).filter(Boolean).sort(function (a, b) { return a.label.localeCompare(b.label, 'pt-BR'); });
    };
    var types = unique(getDocumentType, function (item) { return getDocumentType(item); });
    var folders = unique(function (item) { return item.folder || 'Equipe'; }, function (item, value) { return value; });
    var owners = unique(function (item) { return item.ownerId || item.senderName; }, function (item) {
      var profile = getProfileById(item.ownerId) || getSenderProfile(item);
      return profile && (profile.displayName || profile.nickname) || item.senderName || 'Usuário';
    });
    var projects = unique(function (item) {
      var source = getDocumentProject(item, state);
      return source.project && source.project.id;
    }, function (item) {
      var source = getDocumentProject(item, state);
      return source.project && source.project.name || 'Projeto';
    });
    var sectors = unique(function (item) { return getDocumentSector(item, state); }, function (item) {
      return getDocumentSector(item, state);
    });
    setDocumentFilterOptions('type', 'Todos os tipos', types, documentFilters.type);
    setDocumentFilterOptions('folder', 'Todas as pastas', folders, selectedFolderName);
    setDocumentFilterOptions('owner', 'Todos os responsáveis', owners, documentFilters.owner);
    setDocumentFilterOptions('project', 'Todos os projetos', projects, documentFilters.project);
    setDocumentFilterOptions('sector', 'Todos os setores', sectors, documentFilters.sector);
    Array.prototype.forEach.call(document.querySelectorAll('[data-documents-filter]'), function (control) {
      var key = control.dataset.documentsFilter;
      if (key === 'dateFrom' || key === 'dateTo') control.value = documentFilters[key] || '';
      else if (key === 'sort') control.value = documentFilters.sort || 'recent';
    });
    var favoritesButton = document.querySelector('[data-document-favorites]');
    if (favoritesButton) {
      favoritesButton.classList.toggle('active', documentFilters.favoritesOnly);
      favoritesButton.setAttribute('aria-pressed', String(documentFilters.favoritesOnly));
      favoritesButton.textContent = documentFilters.favoritesOnly ? '★ Favoritos ativos' : '☆ Favoritos';
    }
    document.querySelectorAll('[data-document-view]').forEach(function (button) {
      var active = button.dataset.documentView === documentViewMode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function renderDocumentList() {
    var root = document.getElementById('documents-live-root');
    if (!root || !window.RildonXStore) return;

    var state = window.RildonXStore.getState();
    loadDocumentPreferences();
    var queryInput = document.querySelector('[data-documents-search]');
    var query = String(queryInput && queryInput.value || '').trim().toLocaleLowerCase('pt-BR');
    var allDocuments = getDocuments();
    updateDocumentFilterOptions(allDocuments);
    var documents = allDocuments.filter(function (documentItem) {
      var source = getDocumentProject(documentItem, state);
      var origin = getDocumentOrigin(documentItem, state);
      var profile = getProfileById(documentItem.ownerId) || getSenderProfile(documentItem);
      var ownerValue = documentItem.ownerId || documentItem.senderName || '';
      var sector = getDocumentSector(documentItem, state);
      var date = String(documentItem.sentAt || '').slice(0, 10);
      var searchable = [
        documentItem.name, documentItem.senderName, documentItem.folder, documentItem.fileType,
        profile && (profile.displayName || profile.nickname), sector, source.task && source.task.title,
        source.project && source.project.name, origin.type, origin.label
      ].join(' ').toLocaleLowerCase('pt-BR');
      return (!query || searchable.indexOf(query) !== -1) &&
        (!selectedFolderName || String(documentItem.folder || 'Equipe') === selectedFolderName) &&
        (!documentFilters.type || getDocumentType(documentItem) === documentFilters.type) &&
        (!documentFilters.owner || String(ownerValue) === String(documentFilters.owner)) &&
        (!documentFilters.project || source.project && String(source.project.id) === String(documentFilters.project)) &&
        (!documentFilters.sector || String(sector) === String(documentFilters.sector)) &&
        (!documentFilters.dateFrom || date && date >= documentFilters.dateFrom) &&
        (!documentFilters.dateTo || date && date <= documentFilters.dateTo) &&
        (!documentFilters.favoritesOnly || favoriteDocumentIds.has(String(documentItem.id)));
    });
    documents.sort(function (a, b) {
      if (documentFilters.sort === 'name') return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
      if (documentFilters.sort === 'type') return getDocumentType(a).localeCompare(getDocumentType(b), 'pt-BR');
      if (documentFilters.sort === 'size') return Number(b.size || 0) - Number(a.size || 0);
      var dateDifference = new Date(a.sentAt || 0) - new Date(b.sentAt || 0);
      return documentFilters.sort === 'oldest' ? dateDifference : -dateDifference;
    });
    var pageCount = Math.ceil(documents.length / PAGE_SIZE);
    currentPage = Math.min(currentPage, Math.max(pageCount, 1));
    var pageDocuments = documents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    var emptyIcon = window.RildonXIconMarkup && window.RildonXIconMarkup('document');
    var emptyState = '<div class="document-empty-state"><div class="doc-icon file">' + (emptyIcon || 'ARQ') + '</div><b>' +
      (allDocuments.length ? 'Nenhum documento corresponde aos filtros' : 'Sua biblioteca está pronta para começar') +
      '</b><span>' + (allDocuments.length ? 'Limpe ou ajuste os filtros para ver os arquivos.' : 'Envie um arquivo ou salve um anexo de Mensagens sem criar uma cópia.') +
      '</span>' + (allDocuments.length ? '<button type="button" class="document-clear-filters" data-document-clear-filters>Limpar filtros</button>' : '') + '</div>';
    var content = documentViewMode === 'grid'
      ? '<div class="document-grid">' + (pageDocuments.map(renderDocumentCard).join('') || emptyState) + '</div>'
      : '<div class="doc-table-head"><span>Nome</span><span>Modificado</span><span>Responsável</span><span>Origem</span><span>Ações</span></div>' +
        (pageDocuments.map(renderDocumentRow).join('') || emptyState);
    root.innerHTML = '<div class="document-library-heading"><h2>' + (selectedFolderName ? escapeHtml(selectedFolderName) : 'Biblioteca') +
      '</h2><span>' + documents.length + ' arquivo' + (documents.length === 1 ? '' : 's') + '</span></div>' + content +
      '<div class="pagination"><div class="page-btns"></div><div class="count"></div></div>';
    renderPagination(documents.length, pageCount);
    if (window.RildonXAvatar) window.RildonXAvatar.hydrate(root);
  }

  function getDocumentUrl(documentItem) {
    if (documentItem && documentItem.url && documentItem.url !== '#') {
      return documentItem.url;
    }

    return '';
  }

  function isMedicalDocument(documentItem) {
    var folder = String(documentItem && documentItem.folder || '').trim().toLocaleLowerCase('pt-BR');
    var url = String(documentItem && documentItem.url || '').toLocaleLowerCase('pt-BR');
    return folder === 'exames ocupacionais' || url.indexOf('/hr-medical-exam-files/') !== -1;
  }

  function getStorageObject(fileUrl) {
    if (!window.SUPABASE_URL) return null;

    var supabaseUrl;
    var resolvedUrl;
    try {
      supabaseUrl = new URL(window.SUPABASE_URL);
      resolvedUrl = new URL(fileUrl, window.location.href);
    } catch (error) {
      return null;
    }

    if (resolvedUrl.origin !== supabaseUrl.origin) return null;

    var match = resolvedUrl.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
    if (!match) return null;

    try {
      return {
        bucket: decodeURIComponent(match[1]),
        path: decodeURIComponent(match[2])
      };
    } catch (error) {
      return null;
    }
  }

  function showDocumentActionError(message) {
    if (typeof window.showToast === 'function') window.showToast(message);
  }

  async function getSignedStorageUrl(documentItem, storageObject, download) {
    var client = window.supabaseClient;
    if (!client || !client.storage || typeof client.storage.from !== 'function') {
      throw new Error('O serviço de arquivos não está disponível.');
    }

    var options = download ? { download: documentItem.name || true } : undefined;
    var result = await client.storage
      .from(storageObject.bucket)
      .createSignedUrl(storageObject.path, 60, options);

    if (result.error) throw result.error;
    if (!result.data || !result.data.signedUrl) {
      throw new Error('O serviço não retornou um endereço para este arquivo.');
    }

    return result.data.signedUrl;
  }

  function renderFolderCounts() {
    var counts = folderCounts();
    var folders = getAllFolders();
    var list = document.getElementById('document-folder-list');
    var pagination = document.getElementById('document-folder-pagination');
    if (!list || !pagination) return;

    var createButton = document.getElementById('document-create-folder-btn');
    var customFolderCount = getCustomFolderCount(window.RildonXStore.getState().documentFolders);
    var folderLimitReached = customFolderCount >= MAX_CUSTOM_FOLDERS;
    if (createButton) {
      createButton.disabled = folderLimitReached;
      createButton.textContent = folderLimitReached ? 'Limite atingido' : 'Nova pasta';
      createButton.title = 'Pastas personalizadas: ' + customFolderCount + ' de ' + MAX_CUSTOM_FOLDERS;
    }

    var selectedFolder = selectedFolderName;
    var pageCount = Math.ceil(folders.length / FOLDER_PAGE_SIZE);
    currentFolderPage = Math.min(currentFolderPage, Math.max(pageCount, 1));
    var pageFolders = folders.slice((currentFolderPage - 1) * FOLDER_PAGE_SIZE, currentFolderPage * FOLDER_PAGE_SIZE);
    list.innerHTML = pageFolders.map(function (folder) {
      var folderRecord = (window.RildonXStore.getState().documentFolders || []).find(function (item) {
        return item && typeof item === 'object' && item.name === folder;
      });
      return '<div class="mini-row document-folder-row">' +
        '<button class="document-folder-name' + (folder === selectedFolder ? ' active' : '') + '" type="button" data-folder-select="' + escapeHtml(folder) + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>' +
        '<span>' + escapeHtml(folder) + '</span></button>' +
        '<span class="mini-badge document-folder-count">' + (counts[folder] || 0) + '</span>' +
        (folderRecord ? '<button class="document-folder-delete" type="button" data-folder-delete="' + escapeHtml(folderRecord.id) + '" data-folder-name="' + escapeHtml(folder) + '" title="Remover pasta ' + escapeHtml(folder) + '" aria-label="Remover pasta ' + escapeHtml(folder) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/></svg></button>' : '') +
        '</div>';
    }).join('');

    pagination.innerHTML = pageCount > 1
      ? '<button class="page-btn" type="button" data-folder-page="' + (currentFolderPage - 1) + '"' + (currentFolderPage <= 1 ? ' disabled' : '') + ' aria-label="Página anterior">‹</button>' +
        '<span>Página ' + currentFolderPage + ' de ' + pageCount + '</span>' +
        '<button class="page-btn" type="button" data-folder-page="' + (currentFolderPage + 1) + '"' + (currentFolderPage >= pageCount ? ' disabled' : '') + ' aria-label="Próxima página">›</button>'
      : '';
  }

  function renderStorageUsage(usage) {
    var summary = document.getElementById('storage-usage-summary');
    var fill = document.getElementById('storage-bar-fill');
    var details = document.getElementById('storage-type-breakdown');
    if (!summary || !fill || !details) return;

    var limit = 100 * 1024 * 1024;
    var totalBytes = usage.totalBytes;
    var percentage = Math.min(100, (totalBytes / limit) * 100);
    summary.textContent = window.RildonXDocumentUpload.formatBytes(totalBytes) + ' de 100 MB usados';
    fill.style.width = percentage + '%';
    fill.setAttribute('aria-valuenow', String(Math.round(percentage)));
    fill.parentElement.setAttribute('aria-valuenow', String(Math.round(percentage)));
    fill.classList.toggle('storage-warning', percentage >= 80);
    var types = Object.keys(usage.byType).filter(function(type) {
      return usage.byType[type].count > 0;
    }).sort();
    details.innerHTML = types.map(function (type) {
      var typeUsage = usage.byType[type];
      return '<div class="storage-type-row"><span>' + escapeHtml(type) + '</span><b>' +
        typeUsage.count + ' (' + window.RildonXDocumentUpload.formatBytes(typeUsage.bytes) + ')</b></div>';
    }).join('');
    details.hidden = types.length === 0;
  }

  function waitForSupabaseClient() {
    if (window.supabaseClient) return Promise.resolve(window.supabaseClient);
    if (supabaseClientWait) return supabaseClientWait;
    supabaseClientWait = new Promise(function (resolve, reject) {
      var attempts = 0;
      var timer = window.setInterval(function () {
        attempts += 1;
        if (window.supabaseClient) {
          window.clearInterval(timer);
          resolve(window.supabaseClient);
        } else if (attempts >= 20) {
          window.clearInterval(timer);
          reject(new Error('O cliente Supabase não carregou. Verifique a conexão e atualize a página.'));
        }
      }, 250);
    }).finally(function () {
      supabaseClientWait = null;
    });
    return supabaseClientWait;
  }

  function refreshStorageUsage() {
    if (!document.getElementById('storage-usage-summary')) return;
    if (storageRefreshInProgress) {
      storageRefreshPending = true;
      return;
    }
    storageRefreshInProgress = true;
    (async function () {
      try {
        var client = await waitForSupabaseClient();
        var uploadService = window.RildonXDocumentUpload;
        if (!client.auth || typeof client.auth.getUser !== 'function') throw new Error('A autenticação Supabase não está disponível neste cliente.');
        if (!client.storage || typeof client.storage.from !== 'function') throw new Error('A API do Supabase Storage não está disponível neste cliente.');
        if (!uploadService) throw new Error('O módulo de arquivos não carregou. Atualize a página sem usar o cache.');
        currentUserId = null;
        var userResult = await client.auth.getUser();
        if (userResult.error) throw userResult.error;
        if (!userResult.data || !userResult.data.user) {
          throw new Error('Entre na sua conta para consultar o armazenamento.');
        }
        var currentUser = userResult.data.user;
        currentUserId = currentUser.id;
        loadDocumentPreferences();
        var appMetadata = currentUser.app_metadata || {};
        var adminRole = String(appMetadata.role || '').trim().toLowerCase();
        var loginName = String(currentUser.email || '').split('@')[0].trim().toLowerCase();
        window.RildonXIsAdmin = appMetadata.is_admin === true ||
          adminRole === 'admin' || adminRole === 'administrator' || loginName === 'adson.ri';
        var usage = await uploadService.getUserStorageUsage(client, currentUserId);
        usage.byType = {};
        usage.files.forEach(function (file) {
          var type = uploadService.getStorageFileType({
            name: file.path,
            mimeType: file.mimeType
          });
          if (!usage.byType[type]) usage.byType[type] = { count: 0, bytes: 0 };
          usage.byType[type].count += 1;
          usage.byType[type].bytes += file.size;
        });
        renderStorageUsage(usage);
        renderDocumentList();
      } catch (error) {
        console.error('Não foi possível atualizar o uso do Storage:', error);
        renderDocumentList();
        var summary = document.getElementById('storage-usage-summary');
        var details = document.getElementById('storage-type-breakdown');
        if (summary) summary.textContent = 'Não foi possível consultar o armazenamento.';
        if (details) details.textContent = error && error.message ? error.message : 'Verifique a conexão e tente novamente.';
      } finally {
        storageRefreshInProgress = false;
        if (storageRefreshPending) {
          storageRefreshPending = false;
          scheduleStorageRefresh();
        }
      }
    })();
  }

  function scheduleStorageRefresh() {
    if (storageRefreshTimer) window.clearTimeout(storageRefreshTimer);
    storageRefreshTimer = window.setTimeout(refreshStorageUsage, 250);
  }

  function selectFolder(folder, toggle) {
    var wasActive = selectedFolderName === folder;
    selectedFolderName = folder && !(toggle && wasActive) ? folder : '';
    document.querySelectorAll('.document-folder-name').forEach(function (button) {
      var active = button.dataset.folderSelect === selectedFolderName;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    var folderFilter = document.querySelector('[data-documents-filter="folder"]');
    if (folderFilter) folderFilter.value = selectedFolderName;
    saveDocumentPreferences();
    currentPage = 1;
    renderDocumentList();
  }

  function bindFolderControls() {
    document.addEventListener('click', function (event) {
      var deleteButton = event.target.closest('[data-folder-delete]');
      if (deleteButton) {
        event.preventDefault();
        event.stopPropagation();
        removeFolder(deleteButton);
        return;
      }

      var folderRow = event.target.closest('[data-folder-select]');
      if (folderRow) {
        selectFolder(folderRow.dataset.folderSelect, false);
        return;
      }

      var pageButton = event.target.closest('[data-folder-page]');
      if (pageButton && !pageButton.disabled) {
        currentFolderPage = Number(pageButton.dataset.folderPage);
        renderFolderCounts();
      }
    });
  }

  async function removeFolder(button) {
    var folderId = button.dataset.folderDelete;
    var folderName = button.dataset.folderName;
    if (!folderId || !folderName) return;
    if (DEFAULT_FOLDERS.some(function (folder) {
      return folder.toLocaleLowerCase('pt-BR') === folderName.toLocaleLowerCase('pt-BR');
    })) {
      showDocumentActionError('As pastas padrão não podem ser removidas.');
      return;
    }

    button.disabled = true;
    try {
      var client = window.supabaseClient;
      if (!client || typeof client.from !== 'function') throw new Error('O serviço de pastas não está disponível.');
      var documentResult = await client.from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('folder', folderName);
      if (documentResult.error) throw documentResult.error;
      if (documentResult.count > 0) {
        throw new Error('A pasta contém ' + documentResult.count + ' documento(s). Mova ou remova os documentos antes de excluir a pasta.');
      }

      if (!window.confirm('Remover permanentemente a pasta "' + folderName + '"?')) return;
      var result = await client.from('document_folders')
        .delete()
        .eq('id', folderId)
        .select('id')
        .single();
      if (result.error) throw result.error;

      var state = window.RildonXStore.getState();
      if (selectedFolderName === folderName) selectedFolderName = '';
      window.RildonXStore.setState({
        documentFolders: (state.documentFolders || []).filter(function (folder) {
          return !folder || folder.id !== folderId;
        })
      });
      showDocumentActionError('Pasta removida.');
    } catch (error) {
      console.error('Não foi possível remover a pasta:', error);
      var detail = error && error.message ? ' (' + error.message + ')' : '';
      showDocumentActionError('Não foi possível remover a pasta.' + detail);
    } finally {
      button.disabled = false;
    }
  }

  async function createFolder(event) {
    event.preventDefault();
    var name = String(folderNameInput.value || '').trim();
    if (!name) {
      showDocumentActionError('Informe um nome para a pasta.');
      folderNameInput.focus();
      return;
    }
    if (name.length > 60) {
      showDocumentActionError('O nome da pasta deve ter no máximo 60 caracteres.');
      folderNameInput.focus();
      return;
    }
    if (getAllFolders().some(function (folder) {
      return folder.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR');
    })) {
      showDocumentActionError('Já existe uma pasta com esse nome.');
      folderNameInput.focus();
      return;
    }

    var submit = event.target.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      var client = window.supabaseClient;
      if (!client || typeof client.from !== 'function') {
        throw new Error('O serviço de pastas não está disponível. Recarregue a página e tente novamente.');
      }
      var existingResult = await client.from('document_folders').select('id,name');
      if (existingResult.error) throw existingResult.error;
      var existingFolders = existingResult.data || [];
      if (getCustomFolderCount(existingFolders) >= MAX_CUSTOM_FOLDERS) {
        window.RildonXStore.setState({ documentFolders: existingFolders });
        renderFolderCounts();
        showDocumentActionError('Você já atingiu o limite de 15 pastas personalizadas.');
        return;
      }
      if (existingFolders.some(function (folder) {
        return String(folder.name || '').trim().toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR');
      })) {
        showDocumentActionError('Já existe uma pasta com esse nome.');
        folderNameInput.focus();
        return;
      }
      var result = await client.from('document_folders').insert({ name: name }).select('id,name').single();
      if (result.error) throw result.error;
      window.RildonXStore.setState({
        documentFolders: existingFolders.concat([{ id: result.data.id, name: result.data.name }])
      });
      currentFolderPage = Math.ceil(getAllFolders().length / FOLDER_PAGE_SIZE);
      renderFolderCounts();
      selectFolder(result.data.name, false);
      folderNameInput.value = '';
      if (typeof window.closeModal === 'function') window.closeModal();
      showDocumentActionError('Pasta criada com sucesso.');
    } catch (error) {
      console.error('Não foi possível criar a pasta de documentos:', error);
      var detail = error && error.message ? ' (' + error.message + ')' : '';
      showDocumentActionError('Não foi possível criar a pasta. Verifique se a migração de pastas foi aplicada no Supabase.' + detail);
    } finally {
      submit.disabled = false;
    }
  }

  function bindFolderCreation() {
    var button = document.getElementById('document-create-folder-btn');
    var form = document.getElementById('document-create-folder-form');
    folderNameInput = document.getElementById('document-folder-name');
    if (!button || !form || !folderNameInput) return;
    button.addEventListener('click', function () {
      if (typeof window.openModal === 'function') window.openModal('modal-nova-pasta');
      folderNameInput.focus();
    });
    form.addEventListener('submit', createFolder);
  }

  function bindDocumentUpload() {
    var button = document.getElementById('document-upload-btn');
    var input = document.getElementById('document-upload-input');
    if (!button || !input) return;

    button.addEventListener('click', function () {
      input.click();
    });

    input.addEventListener('change', async function () {
      var files = input.files ? Array.prototype.slice.call(input.files) : [];
      if (!files.length) return;
      if (files.length > 10) {
        showDocumentActionError('Você pode enviar no máximo 10 arquivos por vez.');
        input.value = '';
        return;
      }

      if (!window.RildonXDocumentUpload || !window.RildonXStore) {
        showDocumentActionError('O envio de arquivos não está disponível. Recarregue a página e tente novamente.');
        input.value = '';
        return;
      }

      button.disabled = true;
      openDocumentShareModal('upload', files);
      input.value = '';
    });
  }

  function openDocumentShareModal(mode, value) {
    var modal = document.getElementById('document-share-modal');
    var usersRoot = document.getElementById('document-share-users');
    var title = document.getElementById('document-share-title');
    var caption = document.getElementById('document-share-caption');
    var submit = document.getElementById('document-share-submit');
    var progress = document.getElementById('document-upload-progress');
    if (!modal || !usersRoot || !title || !caption || !submit || !window.RildonXStore) {
      showDocumentActionError('A seleção de visualizadores não está disponível. Atualize a página.');
      var uploadButton = document.getElementById('document-upload-btn');
      if (uploadButton) uploadButton.disabled = false;
      return;
    }

    var profiles = (window.RildonXStore.getState().profiles || []).filter(function (profile) {
      return profile.active !== false && profile.id && profile.id !== currentUserId;
    });
    var selectedIds = mode === 'share' && value && Array.isArray(value.viewerIds) ? value.viewerIds.slice() : [];
    documentShareContext = { mode: mode, value: value, selectedViewerIds: selectedIds };
    if (progress) {
      progress.hidden = mode !== 'upload';
      progress.innerHTML = '';
    }
    title.textContent = mode === 'upload' ? 'Enviar para Documentos' : 'Visualizadores do arquivo';
    caption.textContent = mode === 'upload'
      ? 'Escolha quem poderá abrir ' + (Array.isArray(value) && value.length > 1 ? 'estes ' + value.length + ' arquivos' : 'este arquivo') +
        ' além de você. Sem seleção, somente você terá acesso. Os links de acesso expiram e podem ser renovados pela aplicação.'
      : (value.name || 'Arquivo') + ' · Você pode adicionar ou remover pessoas com acesso.';
    submit.textContent = mode === 'upload'
      ? 'Enviar ' + (Array.isArray(value) && value.length > 1 ? value.length + ' arquivos' : 'arquivo')
      : 'Salvar acessos';
    usersRoot.innerHTML = profiles.length ? profiles.map(function (profile) {
      var selected = selectedIds.indexOf(profile.id) !== -1;
      var profileName = profile.displayName || profile.nickname || 'Usuário';
      return '<div class="document-viewer-option">' +
        getProfileAvatarMarkup(profile, profileName) +
        '<span class="document-viewer-name"><b>' + escapeHtml(profileName) + '</b><small>' +
        escapeHtml(profile.role || profile.nickname || '') + '</small></span>' +
        '<button class="document-viewer-toggle' + (selected ? ' selected' : '') + '" type="button" data-viewer-id="' +
        escapeHtml(profile.id) + '" aria-pressed="' + selected + '" aria-label="' +
        (selected ? 'Remover ' : 'Adicionar ') + escapeHtml(profileName) + '">' + (selected ? '−' : '+') + '</button></div>';
    }).join('') : '<p class="document-viewer-empty">Não há outros usuários ativos para adicionar.</p>';
    modal.hidden = false;
    if (window.RildonXAvatar) window.RildonXAvatar.hydrate(modal);
    submit.focus();
  }

  function closeDocumentShareModal() {
    var modal = document.getElementById('document-share-modal');
    if (modal) modal.hidden = true;
    documentShareContext = null;
    var submit = document.getElementById('document-share-submit');
    if (submit) submit.disabled = false;
    var uploadButton = document.getElementById('document-upload-btn');
    if (uploadButton) uploadButton.disabled = false;
  }

  function bindDocumentShareModal() {
    var modal = document.getElementById('document-share-modal');
    var form = document.getElementById('document-share-form');
    var cancel = document.getElementById('document-share-cancel');
    var close = document.getElementById('document-share-close');
    var submit = document.getElementById('document-share-submit');
    if (!modal || !form || !cancel || !close || !submit || form.dataset.bound === 'true') return;

    [cancel, close].forEach(function (button) {
      button.addEventListener('click', closeDocumentShareModal);
    });
    modal.addEventListener('click', function (event) {
      var toggle = event.target.closest('[data-viewer-id]');
      if (!toggle || !documentShareContext) return;
      var userId = toggle.dataset.viewerId;
      var selectedIds = documentShareContext.selectedViewerIds;
      var selectedIndex = selectedIds.indexOf(userId);
      if (selectedIndex === -1) selectedIds.push(userId);
      else selectedIds.splice(selectedIndex, 1);
      var selected = selectedIndex === -1;
      var profile = getProfileById(userId);
      var profileName = profile && (profile.displayName || profile.nickname) || 'usuário';
      toggle.classList.toggle('selected', selected);
      toggle.setAttribute('aria-pressed', String(selected));
      toggle.setAttribute('aria-label', (selected ? 'Remover ' : 'Adicionar ') + profileName);
      toggle.textContent = selected ? '−' : '+';
    });
    modal.addEventListener('click', function (event) {
      var submitButton = document.getElementById('document-share-submit');
      if (event.target === modal && submitButton && !submitButton.disabled) closeDocumentShareModal();
    });
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (!documentShareContext) return;
      var context = documentShareContext;
      var viewerIds = documentShareContext.selectedViewerIds.slice();
      submit.disabled = true;
      cancel.disabled = true;
      close.disabled = true;
      try {
        if (context.mode === 'upload') {
          var activeFolder = document.querySelector('.document-folder-name.active');
          var state = window.RildonXStore.getState();
          var files = Array.isArray(context.value) ? context.value : [context.value];
          var failures = [];
          var uploadedCount = 0;
          var progressItems = files.map(function (file) {
            return { name: file.name, state: 'Aguardando envio', error: '' };
          });
          var progressRoot = document.getElementById('document-upload-progress');
          var renderUploadProgress = function (activeIndex) {
            if (!progressRoot) return;
            progressRoot.hidden = false;
            progressRoot.innerHTML = '<div class="document-upload-progress-head"><strong>Envio de arquivos</strong><span>' +
              uploadedCount + ' de ' + files.length + ' concluído(s)</span></div><progress max="' + files.length +
              '" value="' + uploadedCount + '" aria-label="Progresso do envio"></progress><ul>' + progressItems.map(function (item, itemIndex) {
              return '<li class="' + (item.state === 'Falha' ? 'is-error' : item.state === 'Enviado' ? 'is-done' : itemIndex === activeIndex ? 'is-uploading' : '') +
                '"><span>' + escapeHtml(item.name) + '</span><b>' + escapeHtml(item.error || item.state) + '</b></li>';
            }).join('') + '</ul>';
          };
          for (var index = 0; index < files.length; index += 1) {
            progressItems[index].state = 'Enviando';
            renderUploadProgress(index);
            try {
              var uploaded = await window.RildonXDocumentUpload.upload(files[index], {
                folder: selectedFolderName || activeFolder && activeFolder.dataset.folderSelect || 'Equipe',
                senderName: state.user && state.user.name || 'Usuário',
                viewerIds: viewerIds
              });
              window.RildonXStore.addDocument(uploaded);
              uploadedCount += 1;
              progressItems[index].state = 'Enviado';
              context.value = files.filter(function (file, fileIndex) { return fileIndex !== index; });
            } catch (uploadError) {
              console.error('Não foi possível enviar "' + files[index].name + '" para Documentos:', uploadError);
              failures.push({ file: files[index], index: index, message: uploadError && uploadError.message || 'Falha no envio' });
              progressItems[index].state = 'Falha';
              progressItems[index].error = uploadError && uploadError.message || 'Falha no envio';
            }
            renderUploadProgress(index);
          }
          context.value = failures.map(function (item) { return item.file; });
          if (failures.length) {
            caption.textContent = uploadedCount + ' arquivo(s) enviado(s). ' + failures.length +
              ' falhou/falharam; tente novamente apenas os arquivos indicados.';
            submit.textContent = 'Tentar novamente (' + failures.length + ')';
            if (!uploadedCount) showDocumentActionError('Nenhum arquivo foi enviado. Corrija ou tente novamente pelos itens com erro.');
          } else {
            showDocumentActionError(uploadedCount + ' arquivo(s) enviado(s) para Documentos.');
            closeDocumentShareModal();
          }
        } else {
          var client = window.supabaseClient;
          if (!client || typeof client.from !== 'function') throw new Error('O serviço de documentos não está disponível.');
          var updateQuery = client.from('documents')
            .update({ viewer_ids: viewerIds })
            .eq('id', context.value.id);
          if (!window.RildonXIsAdmin) updateQuery = updateQuery.eq('owner_id', currentUserId);
          var updateResult = await updateQuery.select('id,viewer_ids').single();
          if (updateResult.error) throw updateResult.error;
          var state = window.RildonXStore.getState();
          window.RildonXStore.setState({
            documents: (state.documents || []).map(function (item) {
              return String(item.id) === String(context.value.id)
                ? Object.assign({}, item, { viewerIds: updateResult.data.viewer_ids || [] })
                : item;
            })
          });
          showDocumentActionError('Acesso ao arquivo atualizado.');
        }
        if (context.mode !== 'upload') closeDocumentShareModal();
      } catch (error) {
        console.error('Não foi possível atualizar o arquivo ou seus visualizadores:', error);
        var detail = error && error.message ? ' (' + error.message + ')' : '';
        showDocumentActionError('Não foi possível concluir a operação.' + detail);
      } finally {
        submit.disabled = false;
        cancel.disabled = false;
        close.disabled = false;
      }
    });
    form.dataset.bound = 'true';
  }

  async function handleDocumentAction(event) {
    var button = event.target.closest('[data-document-action][data-document-id]');
    if (!button || !window.RildonXStore) return;

    var documentItem = (window.RildonXStore.getState().documents || []).find(function (item) {
      return String(item.id) === button.dataset.documentId;
    });
    if (!documentItem) {
      showDocumentActionError('Este documento não está mais disponível.');
      return;
    }

    if (isMedicalDocument(documentItem) &&
        (button.dataset.documentAction === 'remove' || button.dataset.documentAction === 'share')) {
      showDocumentActionError('Gerencie o acesso e a remoção deste documento pelo painel Agendamento de Exames.');
      return;
    }

    if (button.dataset.documentAction === 'remove') {
      if (!currentUserId || !window.RildonXIsAdmin && documentItem.ownerId !== currentUserId) {
        showDocumentActionError('Somente quem enviou este arquivo pode removê-lo.');
        return;
      }
      var confirmed = window.confirm(
        'Remover "' + (documentItem.name || 'este arquivo') + '" permanentemente? O arquivo será apagado do armazenamento e deixará de estar acessível em mensagens e publicações.'
      );
      if (!confirmed) return;
      button.disabled = true;
      try {
        await window.RildonXDocumentUpload.removeDocument(documentItem);
        var state = window.RildonXStore.getState();
        window.RildonXStore.setState({
          documents: (state.documents || []).filter(function (item) {
            return String(item.id) !== String(documentItem.id);
          })
        });
        showDocumentActionError('Arquivo removido permanentemente.');
        scheduleStorageRefresh();
      } catch (error) {
        console.error('Não foi possível remover o arquivo:', error);
        var removeDetail = error && error.message ? ' (' + error.message + ')' : '';
        showDocumentActionError('Não foi possível remover o arquivo.' + removeDetail);
        button.disabled = false;
      }
      return;
    }

    if (button.dataset.documentAction === 'save') {
      if (String(documentItem.folder || '').trim().toLocaleLowerCase('pt-BR') === 'mensagens') {
        showDocumentActionError('Este arquivo já está salvo em Documentos.');
        return;
      }
      button.disabled = true;
      try {
        var client = window.supabaseClient;
        if (!client || typeof client.from !== 'function') {
          throw new Error('O serviço de documentos não está disponível. Recarregue a página e tente novamente.');
        }
        var messageId = button.dataset.messageId || documentItem.messageId || null;
        if (!messageId) throw new Error('Este anexo não está vinculado a uma mensagem.');
        var sourceMessage = (window.RildonXStore.getState().messages || []).find(function (message) {
          return String(message.id) === String(messageId);
        });
        if (sourceMessage && sourceMessage.localOnly === true) {
          var localSaveResult = await client.from('documents')
            .update({ folder: 'Mensagens', message_id: null })
            .eq('id', documentItem.id)
            .eq('owner_id', currentUserId)
            .select('id')
            .single();
          if (localSaveResult.error) throw localSaveResult.error;
          var localState = window.RildonXStore.getState();
          window.RildonXStore.setState({
            documents: (localState.documents || []).map(function (item) {
              return String(item.id) === String(documentItem.id)
                ? Object.assign({}, item, { folder: 'Mensagens', messageId: null })
                : item;
            })
          });
          showDocumentActionError('Arquivo salvo em Documentos com sucesso.');
          scheduleStorageRefresh();
          return;
        }
        if (typeof client.rpc !== 'function') {
          throw new Error('O serviço de documentos não está disponível. Recarregue a página e tente novamente.');
        }
        var updateResult = await client.rpc('save_message_document', { p_document_id: documentItem.id });
        if (updateResult.error) throw updateResult.error;
        window.RildonXStore.addDocument(Object.assign({}, documentItem, {
          folder: 'Mensagens',
          messageId: messageId
        }));
        showDocumentActionError('Arquivo salvo em Documentos com sucesso.');
      } catch (error) {
        console.error('Não foi possível salvar o anexo de mensagem em Documentos:', error);
        var detail = error && error.message ? ' (' + error.message + ')' : '';
        showDocumentActionError('Não foi possível salvar o arquivo em Documentos.' + detail);
      } finally {
        button.disabled = false;
      }
      return;
    }

    if (button.dataset.documentAction === 'share') {
      if (!window.RildonXIsAdmin && documentItem.ownerId !== currentUserId) {
        showDocumentActionError('Somente o proprietário pode alterar os visualizadores deste arquivo.');
        return;
      }
      openDocumentShareModal('share', documentItem);
      return;
    }

    var fileUrl = getDocumentUrl(documentItem);
    if (!fileUrl) {
      showDocumentActionError('Este documento não possui um arquivo vinculado. Envie o arquivo novamente para disponibilizá-lo.');
      return;
    }

    var resolvedUrl;
    try {
      resolvedUrl = new URL(fileUrl, window.location.href);
    } catch (error) {
      showDocumentActionError('O endereço deste documento é inválido.');
      return;
    }

    var allowedProtocol = ['http:', 'https:'].indexOf(resolvedUrl.protocol) !== -1 ||
      (resolvedUrl.protocol === 'blob:' && window.location.protocol === 'file:') ||
      (resolvedUrl.protocol === 'blob:' && resolvedUrl.origin === window.location.origin);
    if (!allowedProtocol) {
      showDocumentActionError('O endereço deste documento não pode ser aberto com segurança.');
      return;
    }

    if (resolvedUrl.protocol === 'blob:') {
      showDocumentActionError('O endereço temporário deste arquivo expirou. Envie o arquivo novamente para abri-lo.');
      return;
    }

    var storageObject = getStorageObject(resolvedUrl.toString());
    var isOpening = button.dataset.documentAction === 'open';
    var popup = null;
    if (isOpening && storageObject) {
      popup = window.open('', '_blank');
      if (!popup) {
        showDocumentActionError('O navegador bloqueou a nova aba. Permita pop-ups para abrir este documento.');
        return;
      }
      popup.opener = null;
    }

    button.disabled = true;
    try {
      var actionUrl = storageObject
        ? await getSignedStorageUrl(documentItem, storageObject, !isOpening)
        : resolvedUrl.toString();

      if (isOpening) {
        if (popup) {
          popup.location.href = actionUrl;
        } else {
          window.open(actionUrl, '_blank', 'noopener,noreferrer');
        }
        return;
      }

      var link = document.createElement('a');
      link.href = actionUrl;
      link.download = documentItem.name || 'documento';
      link.rel = 'noopener';
      if (!storageObject) link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      if (popup && !popup.closed) popup.close();
      var detail = error && error.message ? ' (' + error.message + ')' : '';
      showDocumentActionError('Não foi possível acessar o arquivo. Verifique se ele ainda existe no Storage e se sua conta tem permissão para leitura.' + detail);
    } finally {
      button.disabled = false;
    }
  }

  function handleDocumentViewControls(event) {
    var favoriteButton = event.target.closest('[data-document-favorite]');
    if (favoriteButton) {
      var favoriteId = String(favoriteButton.dataset.documentFavorite);
      if (favoriteDocumentIds.has(favoriteId)) favoriteDocumentIds.delete(favoriteId);
      else favoriteDocumentIds.add(favoriteId);
      saveDocumentPreferences();
      currentPage = 1;
      renderDocumentList();
      return;
    }
    if (event.target.closest('[data-document-favorites]')) {
      documentFilters.favoritesOnly = !documentFilters.favoritesOnly;
      saveDocumentPreferences();
      currentPage = 1;
      renderDocumentList();
      return;
    }
    if (event.target.closest('[data-document-clear-filters]')) {
      documentFilters = { search: '', type: '', owner: '', project: '', sector: '', dateFrom: '', dateTo: '', sort: 'recent', favoritesOnly: false };
      selectedFolderName = '';
      var search = document.querySelector('[data-documents-search]');
      if (search) search.value = '';
      saveDocumentPreferences();
      selectFolder('', false);
      return;
    }
    var viewButton = event.target.closest('[data-document-view]');
    if (viewButton) {
      var nextMode = viewButton.dataset.documentView;
      if (nextMode !== 'list' && nextMode !== 'grid') return;
      documentViewMode = nextMode;
      try {
        localStorage.setItem('rildonx_document_view_mode', documentViewMode);
      } catch (error) {
        console.warn('Não foi possível salvar a visualização dos documentos:', error);
      }
      saveDocumentPreferences();
      renderDocumentList();
      return;
    }
    var card = event.target.closest('.document-grid-card');
    if (card && !event.target.closest('[data-document-action],.document-action-menu,[data-document-favorite]')) {
      var openButton = card.querySelector('[data-document-action="open"]');
      if (openButton) openButton.click();
    }
  }

  function bindDocumentFilterControls() {
    var search = document.querySelector('[data-documents-search]');
    if (search) search.addEventListener('input', function () {
      currentPage = 1;
      documentFilters.search = search.value;
      saveDocumentPreferences();
      renderDocumentList();
    });
    document.addEventListener('change', function (event) {
      var control = event.target.closest('[data-documents-filter]');
      if (!control) return;
      var key = control.dataset.documentsFilter;
      if (key === 'folder') {
        selectFolder(control.value, false);
        return;
      }
      if (key === 'dateFrom' || key === 'dateTo') {
        documentFilters[key] = control.value;
      } else if (['type', 'owner', 'project', 'sector'].indexOf(key) !== -1) {
        documentFilters[key] = control.value;
      } else if (key === 'sort') {
        documentFilters.sort = control.value;
      } else {
        return;
      }
      currentPage = 1;
      saveDocumentPreferences();
      renderDocumentList();
    });
  }

  function bootstrapDocumentSync() {
    bindDocumentUpload();
    bindDocumentShareModal();

    loadDocumentPreferences();
    bindDocumentFilterControls();
    bindFolderCreation();
    bindFolderControls();

    document.addEventListener('click', handleDocumentViewControls);
    document.addEventListener('click', handleDocumentAction);
    renderDocumentList();
    renderFolderCounts();

    if (window.RildonXStore && typeof window.RildonXStore.subscribe === 'function') {
      window.RildonXStore.subscribe(function () {
        renderDocumentList();
        renderFolderCounts();
        scheduleStorageRefresh();
      });
    }
    window.addEventListener('rildonx:storage-changed', scheduleStorageRefresh);
    window.addEventListener('focus', scheduleStorageRefresh);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) scheduleStorageRefresh();
    });
    window.setInterval(scheduleStorageRefresh, 60000);
    scheduleStorageRefresh();
  }

  window.addEventListener('DOMContentLoaded', bootstrapDocumentSync);
})();
