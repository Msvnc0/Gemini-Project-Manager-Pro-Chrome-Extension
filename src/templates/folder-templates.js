/**
 * folder-templates.js — Pre-built Folder Structures
 *
 * Ready-to-use templates for common project organizations.
 * Users can quickly set up a structured workspace.
 */

const GPM_FOLDER_TEMPLATES = {
  'work-setup': {
    name: 'İş Kurulumu',
    nameEn: 'Work Setup',
    icon: '💼',
    description: 'Toplantılar, projeler ve fikirler için yapı',
    structure: [
      {
        name: 'Toplantılar',
        nameEn: 'Meetings',
        icon: '📅',
        children: [
          { name: 'Günlük', nameEn: 'Daily', icon: '📆' },
          { name: 'Haftalık', nameEn: 'Weekly', icon: '📊' },
        ],
      },
      {
        name: 'Projeler',
        nameEn: 'Projects',
        icon: '📁',
        children: [
          { name: 'Aktif', nameEn: 'Active', icon: '🚀' },
          { name: 'Beklemede', nameEn: 'Pending', icon: '⏳' },
          { name: 'Arşiv', nameEn: 'Archive', icon: '📦' },
        ],
      },
      { name: 'Fikirler', nameEn: 'Ideas', icon: '💡' },
      { name: 'Araştırma', nameEn: 'Research', icon: '🔍' },
      { name: 'Notlar', nameEn: 'Notes', icon: '📝' },
    ],
  },

  'developer-setup': {
    name: 'Geliştirici',
    nameEn: 'Developer',
    icon: '👨‍💻',
    description: 'Bug tracking, features ve dokümantasyon',
    structure: [
      { name: 'Buglar', nameEn: 'Bugs', icon: '🐛' },
      {
        name: 'Features',
        nameEn: 'Features',
        icon: '✨',
        children: [
          { name: 'Planlanan', nameEn: 'Planned', icon: '📋' },
          { name: 'Geliştirme', nameEn: 'In Progress', icon: '🔧' },
          { name: 'Tamamlanan', nameEn: 'Completed', icon: '✅' },
        ],
      },
      { name: 'Refactoring', nameEn: 'Refactoring', icon: '🔨' },
      { name: 'Dokümantasyon', nameEn: 'Documentation', icon: '📚' },
      { name: 'Code Review', nameEn: 'Code Review', icon: '👀' },
      { name: 'Test', nameEn: 'Testing', icon: '🧪' },
    ],
  },

  'personal-setup': {
    name: 'Kişisel',
    nameEn: 'Personal',
    icon: '🏠',
    description: 'Günlük, hedefler ve öğrenme',
    structure: [
      { name: 'Günlük', nameEn: 'Journal', icon: '📔' },
      { name: 'Hedefler', nameEn: 'Goals', icon: '🎯' },
      {
        name: 'Öğrenme',
        nameEn: 'Learning',
        icon: '📖',
        children: [
          { name: 'Kitaplar', nameEn: 'Books', icon: '📕' },
          { name: 'Kurslar', nameEn: 'Courses', icon: '🎓' },
        ],
      },
      { name: 'Alışveriş', nameEn: 'Shopping', icon: '🛒' },
      { name: 'Sağlık', nameEn: 'Health', icon: '💪' },
    ],
  },

  'student-setup': {
    name: 'Öğrenci',
    nameEn: 'Student',
    icon: '🎓',
    description: 'Dersler, ödevler ve notlar',
    structure: [
      { name: 'Dersler', nameEn: 'Classes', icon: '📚' },
      {
        name: 'Ödevler',
        nameEn: 'Homework',
        icon: '📝',
        children: [
          { name: 'Bekleyen', nameEn: 'Pending', icon: '⏳' },
          { name: 'Teslim Edilen', nameEn: 'Submitted', icon: '✅' },
        ],
      },
      { name: 'Projeler', nameEn: 'Projects', icon: '🔬' },
      { name: 'Sınavlar', nameEn: 'Exams', icon: '📋' },
      { name: 'Notlar', nameEn: 'Notes', icon: '📓' },
    ],
  },

  'creative-setup': {
    name: 'Yaratıcı',
    nameEn: 'Creative',
    icon: '🎨',
    description: 'Yazı, müzik ve tasarım projeleri',
    structure: [
      {
        name: 'Yazılar',
        nameEn: 'Writing',
        icon: '✍️',
        children: [
          { name: 'Taslaklar', nameEn: 'Drafts', icon: '📝' },
          { name: 'Yayınlanan', nameEn: 'Published', icon: '📰' },
        ],
      },
      { name: 'Müzik', nameEn: 'Music', icon: '🎵' },
      { name: 'Tasarım', nameEn: 'Design', icon: '🎨' },
      { name: 'Fotoğraf', nameEn: 'Photography', icon: '📷' },
      { name: 'İlham', nameEn: 'Inspiration', icon: '💡' },
    ],
  },
};

async function applyTemplate(templateId) {
  const template = GPM_FOLDER_TEMPLATES[templateId];
  if (!template) {
    gpmError('Template not found:', templateId);
    return false;
  }

  async function createStructure(items, parentId = null) {
    for (const item of items) {
      const project = await GPMStorage.createProject({
        name: item.name,
        icon: item.icon || '📁',
        color: '#8ab4f8',
        parentId,
      });

      if (item.children && item.children.length > 0) {
        await createStructure(item.children, project.id);
      }
    }
  }

  await createStructure(template.structure);
  gpmRenderTree();

  return true;
}

function getTemplateList() {
  return Object.entries(GPM_FOLDER_TEMPLATES).map(([id, template]) => ({
    id,
    name: template.name,
    nameEn: template.nameEn,
    icon: template.icon,
    description: template.description,
  }));
}
