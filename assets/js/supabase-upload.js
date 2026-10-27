import { supabase } from './supabase-client.js';

export async function uploadDocumentToSupabase(file, senderName = 'Usuário') {
  if (!file) {
    throw new Error('Selecione um arquivo antes de enviar.');
  }

  const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('rildonx-files')
    .upload(fileName, file);

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicUrlData } = supabase.storage
    .from('rildonx-files')
    .getPublicUrl(uploadData.path);

  const payload = {
    name: file.name,
    file_type: file.type || 'file',
    size: file.size,
    size_label: formatBytes(file.size),
    sender_name: senderName,
    sender_initials: getInitials(senderName),
    sent_at: new Date().toISOString(),
    folder: 'Equipe',
    url: publicUrlData.publicUrl,
    mime_type: file.type || 'application/octet-stream'
  };

  const { data: documentData, error: dbError } = await supabase
    .from('documents')
    .insert([payload])
    .select();

  if (dbError) {
    throw dbError;
  }

  return documentData[0];
}

export async function insertMessageWithDocument(file, messageText = 'Arquivo enviado', senderName = 'Usuário') {
  const document = await uploadDocumentToSupabase(file, senderName);

  const { error } = await supabase.from('messages').insert([
    {
      conversation_id: 'grupo-principal',
      sender_name: senderName,
      text: messageText,
      sent_at: new Date().toISOString(),
      attachments: [{
        id: document.id,
        name: document.name,
        url: document.url
      }]
    }
  ]);

  if (error) {
    throw error;
  }

  return document;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(1)} ${sizes[i]}`;
}

function getInitials(name) {
  const parts = String(name || 'U').trim().split(/\s+/);
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || 'U';
}
