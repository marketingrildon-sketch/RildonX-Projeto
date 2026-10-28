(function () {
  'use strict';

  var BUCKET = 'rildonx-files';
  var signedUrlCache = {};
  var USER_STORAGE_LIMIT = 100 * 1024 * 1024;
  var FILE_SIZE_LIMITS = {
    image: 1024 * 1024,
    video: 5 * 1024 * 1024,
    pdf: 3 * 1024 * 1024,
    other: 1 * 1024 * 1024
  };

  function formatBytes(bytes) {
    var units = ['Bytes', 'KB', 'MB', 'GB'];
    var size = Number(bytes) || 0;
    var unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    return (unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)) + ' ' + units[unitIndex];
  }

  function getFileCategory(file) {
    var mimeType = String(file && (file.type || file.mimeType || file.fileType) || '').toLowerCase();
    var extension = String(file && file.name || '').split('.').pop().toLowerCase();
    if (mimeType.indexOf('image/') === 0 || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'heic', 'heif', 'avif'].indexOf(extension) !== -1) return 'image';
    if (mimeType.indexOf('video/') === 0 || ['mp4', 'm4v', 'mov', 'avi', 'mkv', 'webm', 'mpeg', 'mpg', '3gp'].indexOf(extension) !== -1) return 'video';
    if (mimeType === 'application/pdf' || extension === 'pdf') return 'pdf';
    return 'other';
  }

  function getStorageFileType(file) {
    var name = String(file && file.name || file && file.path || '');
    var extension = name.split('/').pop().split('.').pop().toLowerCase();
    if (extension && extension !== name.split('/').pop()) return extension.toUpperCase();
    var mimeType = String(file && (file.mimeType || file.type) || '').toLowerCase();
    return mimeType ? mimeType : 'Sem extensão';
  }

  function validateFileSize(file) {
    var category = getFileCategory(file);
    var limit = FILE_SIZE_LIMITS[category];
    if (file.size > limit) {
      var limitLabel = category === 'image' ? '1 MB' : category === 'video' ? '5 MB' : category === 'pdf' ? '3 MB' : '1 MB';
      throw new Error('Este arquivo excede o limite de ' + limitLabel + ' para ' +
        (category === 'image' ? 'imagens' : category === 'video' ? 'vídeos' : category === 'pdf' ? 'PDFs' : 'outros arquivos') + '.');
    }
  }

  function isMissingViewerIdsColumn(error) {
    var message = String(error && error.message || '').toLowerCase();
    return message.indexOf('viewer_ids') !== -1 &&
      (message.indexOf('schema cache') !== -1 ||
        message.indexOf('does not exist') !== -1 ||
        message.indexOf('could not find') !== -1);
  }

  async function listUserStorageObjects(client, userId) {
    var storage = client.storage.from(BUCKET);
    var objects = [];
    var folders = [userId];

    while (folders.length) {
      var folder = folders.shift();
      var offset = 0;
      var page;
      do {
        var result = await storage.list(folder, {
          limit: 100,
          offset: offset,
          sortBy: { column: 'name', order: 'asc' }
        });
        if (result.error) throw result.error;
        page = result.data || [];
        page.forEach(function (item) {
          if (item.id == null && !item.metadata) {
            folders.push(folder + '/' + item.name);
            return;
          }
          var size = Number(item.metadata && item.metadata.size);
          if (!Number.isFinite(size) || size < 0) {
            throw new Error('O Storage retornou um arquivo sem tamanho válido; o uso não pode ser calculado com segurança.');
          }
          objects.push({
            path: folder + '/' + item.name,
            size: size,
            mimeType: String(item.metadata && (item.metadata.mimetype || item.metadata.contentType) || '').toLowerCase()
          });
        });
        offset += page.length;
      } while (page.length === 100);
    }

    return objects;
  }

  async function getUserStorageUsage(client, userId) {
    var documentResult = await client.from('documents')
      .select('id,owner_id,url,name,mime_type,folder,message_id,related_task_id,related_project_id')
      .eq('owner_id', userId);
    if (documentResult.error) throw documentResult.error;

    var includedPaths = new Set((documentResult.data || []).filter(function (row) {
      var folder = String(row.folder || '').trim().toLocaleLowerCase('pt-BR');
      return folder !== 'mural' &&
        folder.indexOf('mensagens não salvas') !== 0 &&
        (!row.message_id || folder === 'mensagens') &&
        !row.related_task_id &&
        !row.related_project_id;
    }).map(function (row) {
      return getOwnedDocumentPath({ url: row.url }, userId);
    }).filter(Boolean));
    var objects = (await listUserStorageObjects(client, userId)).filter(function (object) {
      return includedPaths.has(object.path);
    });
    return {
      files: objects,
      totalBytes: objects.reduce(function (total, object) { return total + object.size; }, 0)
    };
  }

  function notifyStorageChanged() {
    window.dispatchEvent(new CustomEvent('rildonx:storage-changed'));
  }

  function getDocumentStoragePath(documentItem) {
    if (!documentItem || !documentItem.url) return '';
    try {
      var supabaseUrl = new URL(window.SUPABASE_URL);
      var fileUrl = new URL(documentItem.url, window.location.href);
      if (fileUrl.origin !== supabaseUrl.origin) return '';
      var match = fileUrl.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
      if (!match || decodeURIComponent(match[1]) !== BUCKET) return '';
      return decodeURIComponent(match[2]);
    } catch (error) {
      return '';
    }
  }

  function getOwnedDocumentPath(documentItem, userId) {
    if (!userId) return '';
    var path = getDocumentStoragePath(documentItem);
    return path && path.split('/')[0] === userId ? path : '';
  }

  function canRemoveDocument(documentItem, userId) {
    return Boolean(userId && (
      window.RildonXIsAdmin ||
      documentItem && documentItem.ownerId === userId ||
      getOwnedDocumentPath(documentItem, userId)
    ));
  }

  async function prepareProfileImage(file) {
    if (file.type === 'image/gif') return file;

    var bitmap;
    var objectUrl;
    try {
      if (typeof createImageBitmap === 'function') {
        bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      } else {
        objectUrl = URL.createObjectURL(file);
        bitmap = await new Promise(function(resolve, reject) {
          var image = new Image();
          image.onload = function() {
            resolve({
              width: image.naturalWidth,
              height: image.naturalHeight,
              draw: function(context, size) {
                var crop = Math.min(image.naturalWidth, image.naturalHeight);
                var x = (image.naturalWidth - crop) / 2;
                var y = (image.naturalHeight - crop) / 2;
                context.drawImage(image, x, y, crop, crop, 0, 0, size, size);
              },
              close: function() {}
            });
          };
          image.onerror = function() { reject(new Error('Não foi possível processar a imagem selecionada.')); };
          image.src = objectUrl;
        });
      }
    } catch (error) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      throw new Error('Não foi possível processar a imagem selecionada.');
    }

    try {
      var size = 512;
      var canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      var context = canvas.getContext('2d');
      if (!context) throw new Error('Não foi possível preparar a imagem de perfil.');
      if (typeof bitmap.draw === 'function') {
        bitmap.draw(context, size);
      } else {
        var crop = Math.min(bitmap.width, bitmap.height);
        var x = (bitmap.width - crop) / 2;
        var y = (bitmap.height - crop) / 2;
        context.drawImage(bitmap, x, y, crop, crop, 0, 0, size, size);
      }
      var blob = await new Promise(function(resolve, reject) {
        canvas.toBlob(function(result) {
          if (!result) {
            reject(new Error('Não foi possível compactar a imagem de perfil.'));
            return;
          }
          resolve(result);
        }, 'image/webp', 0.86);
      });
      if (blob.type !== 'image/webp') {
        blob = await new Promise(function(resolve, reject) {
          canvas.toBlob(function(result) {
            if (!result) {
              reject(new Error('Não foi possível compactar a imagem de perfil.'));
              return;
            }
            resolve(result);
          }, 'image/jpeg', 0.88);
        });
      }
      return new File([blob], 'profile-avatar.' + (blob.type === 'image/webp' ? 'webp' : 'jpg'), {
        type: blob.type,
        lastModified: Date.now()
      });
    } finally {
      if (typeof bitmap.close === 'function') bitmap.close();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }

  function createStoragePath(file, userId, scope) {
    var id = window.crypto && typeof window.crypto.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : Date.now() + '-' + Math.random().toString(16).slice(2);
    var extension = String(file.name || '').match(/\.[a-z0-9]{1,10}$/i);
    return userId + '/' + scope + '/' + id + (extension ? extension[0].toLowerCase() : '');
  }

  function mapDocument(row) {
    return {
      id: row.id,
      name: row.name,
      fileType: row.file_type || 'file',
      size: row.size || 0,
      sizeLabel: row.size_label || formatBytes(row.size),
      senderName: row.sender_name || 'Usuário',
      senderInitials: row.sender_initials || 'U',
      ownerId: row.owner_id || row.ownerId || null,
      viewerIds: Array.isArray(row.viewer_ids) ? row.viewer_ids : [],
      sentAt: row.sent_at || new Date().toISOString(),
      folder: row.folder || 'Equipe',
      messageId: row.message_id || null,
      url: row.url || '#',
      mimeType: row.mime_type || 'application/octet-stream',
      relatedTaskId: row.related_task_id || null,
      relatedProjectId: row.related_project_id || null
    };
  }

  async function getViewUrl(documentItem, options) {
    if (!documentItem || !documentItem.url || documentItem.url === '#') return '';

    var downloadName = options && options.downloadName ? String(options.downloadName) : '';
    var supabaseUrl;
    var fileUrl;
    try {
      supabaseUrl = new URL(window.SUPABASE_URL);
      fileUrl = new URL(documentItem.url, window.location.href);
    } catch (error) {
      return documentItem.url;
    }

    if (fileUrl.origin !== supabaseUrl.origin) return documentItem.url;

    var match = fileUrl.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
    if (!match) return documentItem.url;

    var bucket;
    var path;
    try {
      bucket = decodeURIComponent(match[1]);
      path = decodeURIComponent(match[2]);
    } catch (error) {
      return documentItem.url;
    }

    var cacheKey = bucket + '/' + path + (downloadName ? '|download:' + downloadName : '');
    if (!signedUrlCache[cacheKey] || signedUrlCache[cacheKey].expiresAt <= Date.now()) {
      var client = window.supabaseClient;
      if (!client || !client.storage || typeof client.storage.from !== 'function') return '';

      signedUrlCache[cacheKey] = {
        expiresAt: Date.now() + (50 * 60 * 1000),
        promise: (async function () {
          await getAuthenticatedUser(client, false);
          var result = await client.storage.from(bucket).createSignedUrl(path, 3600,
            downloadName ? { download: downloadName } : undefined);
          if (result.error && isExpiredTokenError(result.error)) {
            await getAuthenticatedUser(client, true);
            result = await client.storage.from(bucket).createSignedUrl(path, 3600,
              downloadName ? { download: downloadName } : undefined);
          }
          if (result.error) throw result.error;
          if (!result.data || !result.data.signedUrl) throw new Error('O Storage não retornou um endereço para a imagem.');
          return result.data.signedUrl;
        })().catch(function (error) {
          delete signedUrlCache[cacheKey];
          throw error;
        })
      };
    }

    return signedUrlCache[cacheKey].promise;
  }

  function isExpiredTokenError(error) {
    var message = String(error && error.message || error || '').toLowerCase();
    return message.indexOf('exp claim timestamp check failed') !== -1 ||
      message.indexOf('jwt expired') !== -1 ||
      message.indexOf('token is expired') !== -1 ||
      message.indexOf('expired token') !== -1;
  }

  async function getAuthenticatedUser(client, forceRefresh) {
    var sessionResult = await client.auth.getSession();
    if (sessionResult.error) throw sessionResult.error;

    var session = sessionResult.data && sessionResult.data.session;
    if (!session || !session.refresh_token) {
      throw new Error('Sua sessão expirou. Entre novamente para enviar arquivos.');
    }

    var expiresSoon = !session.expires_at || session.expires_at <= Math.floor(Date.now() / 1000) + 60;
    if (forceRefresh || expiresSoon) {
      var refreshResult = await client.auth.refreshSession();
      if (refreshResult.error || !refreshResult.data || !refreshResult.data.session) {
        throw new Error('Sua sessão expirou. Saia da conta e entre novamente para enviar arquivos.');
      }
    }

    var userResult = await client.auth.getUser();
    if (userResult.error && !forceRefresh && isExpiredTokenError(userResult.error)) {
      return getAuthenticatedUser(client, true);
    }
    if (userResult.error) throw userResult.error;
    if (!userResult.data.user) {
      throw new Error('Sua sessão expirou. Entre novamente para enviar arquivos.');
    }

    return userResult.data.user;
  }

  async function upload(file, options) {
    if (!file) throw new Error('Selecione um arquivo antes de enviar.');
    validateFileSize(file);

    var client = window.supabaseClient;
    if (!client || !client.storage || typeof client.storage.from !== 'function') {
      throw new Error('O serviço de arquivos não está disponível. Recarregue a página e tente novamente.');
    }

    var user = await getAuthenticatedUser(client, false);
    var settings = options || {};
    var folderName = String(settings.folder || 'Equipe').trim().toLocaleLowerCase('pt-BR');
    var scope = folderName === 'mural' ? 'mural' :
      folderName.indexOf('mensagens não salvas') === 0 ? 'messages' : 'documents';
    if (scope === 'documents') {
      var usage = await getUserStorageUsage(client, user.id);
      if (usage.totalBytes + file.size > USER_STORAGE_LIMIT) {
        throw new Error('Você atingiu o limite de 100 MB de Documentos. Remova arquivos antigos antes de enviar outros.');
      }
    }

    var storagePath = createStoragePath(file, user.id, scope);
    var storage = client.storage.from(BUCKET);
    var uploadOptions = {
      contentType: file.type || 'application/octet-stream',
      upsert: false
    };
    var uploadResult = await storage.upload(storagePath, file, uploadOptions);

    if (uploadResult.error && isExpiredTokenError(uploadResult.error)) {
      await getAuthenticatedUser(client, true);
      uploadResult = await storage.upload(storagePath, file, uploadOptions);
    }

    if (uploadResult.error) throw uploadResult.error;

    var publicUrlResult = storage.getPublicUrl(uploadResult.data.path);
    var publicUrl = publicUrlResult && publicUrlResult.data && publicUrlResult.data.publicUrl;
    if (!publicUrl) {
      var cleanupResult = await storage.remove([uploadResult.data.path]);
      if (cleanupResult.error) console.error('Falha ao remover arquivo sem URL:', cleanupResult.error);
      throw new Error('O Storage não retornou um endereço para o arquivo.');
    }

    var name = String(settings.senderName || 'Usuário');
    var payload = {
      name: file.name,
      file_type: String(file.name || '').split('.').pop().toLowerCase(),
      size: file.size,
      size_label: formatBytes(file.size),
      sender_name: name,
      sender_initials: name.split(/\s+/).map(function (part) {
        return part.charAt(0);
      }).join('').slice(0, 2).toUpperCase() || 'U',
      owner_id: user.id,
      viewer_ids: Array.isArray(settings.viewerIds) ? settings.viewerIds.filter(function (id) {
        return typeof id === 'string' && id !== user.id;
      }) : [],
      sent_at: new Date().toISOString(),
      folder: settings.folder || 'Equipe',
      url: publicUrl,
      mime_type: file.type || 'application/octet-stream'
    };
    if (typeof settings.relatedTaskId === 'string' && /^[0-9a-f-]{36}$/i.test(settings.relatedTaskId)) {
      payload.related_task_id = settings.relatedTaskId;
    }
    if (typeof settings.relatedProjectId === 'string' && /^[0-9a-f-]{36}$/i.test(settings.relatedProjectId)) {
      payload.related_project_id = settings.relatedProjectId;
    }

    var documentResult = await client.from('documents').insert(payload).select('*').single();
    if (documentResult.error && isMissingViewerIdsColumn(documentResult.error)) {
      console.warn('A coluna viewer_ids não existe em documents; repetindo o upload sem metadados de compartilhamento.');
      delete payload.viewer_ids;
      documentResult = await client.from('documents').insert(payload).select('*').single();
    }
    if (documentResult.error) {
      var rollbackResult = await storage.remove([uploadResult.data.path]);
      if (rollbackResult.error) console.error('Falha ao remover upload sem registro:', rollbackResult.error);
      throw documentResult.error;
    }

    notifyStorageChanged();
    return mapDocument(documentResult.data);
  }

  async function uploadProfileImage(file, targetUserId) {
    if (!file) throw new Error('Selecione uma imagem antes de enviar.');
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
      throw new Error('A imagem deve estar no formato PNG, JPG, WebP ou GIF.');
    }
    if (file.size > 5 * 1024 * 1024) throw new Error('A imagem de perfil original deve ter no máximo 5 MB.');

    var client = window.supabaseClient;
    if (!client || !client.storage || typeof client.storage.from !== 'function') {
      throw new Error('O serviço de arquivos não está disponível. Recarregue a página e tente novamente.');
    }
    var user = await getAuthenticatedUser(client, false);
    var ownerId = targetUserId || user.id;
    if (ownerId !== user.id) {
      var appMetadata = user.app_metadata || {};
      var adminRole = String(appMetadata.role || '').trim().toLowerCase();
      var loginName = String(user.email || '').split('@')[0].trim().toLowerCase();
      if (appMetadata.is_admin !== true && adminRole !== 'admin' &&
          adminRole !== 'administrator' && loginName !== 'adson.ri') {
        throw new Error('Somente administradores podem alterar a foto de outra pessoa.');
      }
    }
    var optimizedFile = await prepareProfileImage(file);
    validateFileSize(optimizedFile);
    var extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }[optimizedFile.type];
    var id = window.crypto && typeof window.crypto.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : Date.now() + '-' + Math.random().toString(16).slice(2);
    var storagePath = ownerId + '/profile/' + id + '.' + extension;
    var storage = client.storage.from(BUCKET);
    var uploadResult = await storage.upload(storagePath, optimizedFile, {
      contentType: optimizedFile.type,
      upsert: false
    });
    if (uploadResult.error && isExpiredTokenError(uploadResult.error)) {
      await getAuthenticatedUser(client, true);
      uploadResult = await storage.upload(storagePath, optimizedFile, {
        contentType: optimizedFile.type,
        upsert: false
      });
    }
    if (uploadResult.error) throw uploadResult.error;

    var urlResult = storage.getPublicUrl(uploadResult.data.path);
    var url = urlResult && urlResult.data && urlResult.data.publicUrl;
    if (!url) {
      var cleanup = await storage.remove([uploadResult.data.path]);
      if (cleanup.error) console.error('Falha ao remover foto sem URL:', cleanup.error);
      throw new Error('O Storage não retornou um endereço para a imagem.');
    }
    notifyStorageChanged();
    return { url: url, path: uploadResult.data.path };
  }

  async function removeProfileImage(url, userId) {
    if (!url || !userId) return false;
    var resolved;
    try {
      resolved = new URL(url, window.location.href);
      var supabaseUrl = new URL(window.SUPABASE_URL);
      if (resolved.origin !== supabaseUrl.origin) return false;
    } catch (error) {
      return false;
    }
    var match = resolved.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
    if (!match) return false;
    var bucket;
    var path;
    try {
      bucket = decodeURIComponent(match[1]);
      path = decodeURIComponent(match[2]);
    } catch (error) {
      return false;
    }
    if (bucket !== BUCKET) return false;
    if (path.indexOf(userId + '/profile/') !== 0) return false;

    var client = window.supabaseClient;
    var result = await client.storage.from(BUCKET).remove([path]);
    if (result.error) throw result.error;
    notifyStorageChanged();
    return true;
  }

  async function removeDocument(documentItem) {
    if (!documentItem || !documentItem.id) throw new Error('O documento não está disponível para remoção.');
    var client = window.supabaseClient;
    if (!client || !client.storage || typeof client.storage.from !== 'function' || typeof client.from !== 'function') {
      throw new Error('O serviço de arquivos não está disponível. Recarregue a página e tente novamente.');
    }
    var user = await getAuthenticatedUser(client, false);
    var isAdmin = Boolean(window.RildonXIsAdmin);
    var path = isAdmin ? getDocumentStoragePath(documentItem) : getOwnedDocumentPath(documentItem, user.id);
    if (!path || (!isAdmin && documentItem.ownerId && documentItem.ownerId !== user.id)) {
      throw new Error('Somente quem enviou este arquivo pode removê-lo.');
    }

    if (!documentItem.ownerId && !isAdmin) {
      var ownershipResult = await client.from('documents')
        .update({ owner_id: user.id })
        .eq('id', documentItem.id)
        .select('id')
        .single();
      if (ownershipResult.error) {
        console.error('Não foi possível confirmar a autoria do arquivo antes da remoção:', ownershipResult.error);
        throw new Error('Não foi possível confirmar a autoria no banco. Verifique se a migração de armazenamento foi aplicada.');
      }
    }
    var storageResult = await client.storage.from(BUCKET).remove([path]);
    if (storageResult.error) throw storageResult.error;
    notifyStorageChanged();
    var documentQuery = client.from('documents').delete().eq('id', documentItem.id);
    if (!isAdmin) documentQuery = documentQuery.eq('owner_id', user.id);
    var documentResult = await documentQuery.select('id').single();
    if (documentResult.error) {
      console.error('O arquivo foi removido do Storage, mas o registro não pôde ser removido:', documentResult.error);
      throw new Error('O arquivo foi removido do Storage, mas não foi possível remover o registro do banco de dados. Atualize a página e tente novamente.');
    }
    return documentItem.id;
  }

  window.RildonXDocumentUpload = {
    upload: upload,
    getUserStorageUsage: getUserStorageUsage,
    getFileCategory: getFileCategory,
    getStorageFileType: getStorageFileType,
    formatBytes: formatBytes,
    canRemoveDocument: canRemoveDocument,
    removeDocument: removeDocument,
    uploadProfileImage: uploadProfileImage,
    removeProfileImage: removeProfileImage,
    getViewUrl: getViewUrl
  };
})();
