/**
 * Contra el Maltrato Animal — Tartagal, Salta
 * Controlador Frontend Seguro (Prevención Estricta de XSS)
 * Ningún dato de usuario se inyecta con innerHTML; todo el DOM se construye mediante createElement y textContent.
 */

const state = {
  adminKey: sessionStorage.getItem('tartagal_admin_key') || '',
  updates: [],
  photos: [],
  interviews: [],
  petition: null,
  revealedPhotoIds: new Set(), // IDs de imágenes sensibles reveladas en la sesión actual
  currentFilter: 'all',
  stackIndex: 0,
  isPlaying: true,
  stackTimer: null,
};

// Tarjeta por defecto cuando aún no se han subido fotos a la base de datos
const PLACEHOLDER_PHOTOS = [
  {
    id: 'placeholder-1',
    image_url: 'data:image/svg+xml;utf8,' + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
        <rect width="800" height="600" fill="#141414"/>
        <rect x="24" y="24" width="752" height="552" fill="none" stroke="#C81E1E" stroke-width="4"/>
        <text x="50" y="80" fill="#FAF8F3" font-family="monospace" font-size="22" font-weight="bold">ARCHIVO DOCUMENTAL — TARTAGAL, SALTA</text>
        <text x="50" y="260" fill="#FAF8F3" font-family="Georgia, serif" font-size="40" font-weight="bold">Punto Norte</text>
        <text x="50" y="320" fill="#E7E0D2" font-family="sans-serif" font-size="22">Reclamo vecinal de justicia y peritajes toxicológicos</text>
        <text x="50" y="520" fill="#C81E1E" font-family="monospace" font-size="18">Utiliza el Panel de Carga para subir fotografías atorias</text>
      </svg>`),
    caption: 'Reclamo vecinal en Punto Norte por los presuntos asesinatos de felinos.',
    is_sensitive: 0,
  },
];

// ================= SECCIÓN 01: ARCHIVO FOTOGRÁFICO SOLAPADO =================

function getActivePhotos() {
  return state.photos.length > 0 ? state.photos : PLACEHOLDER_PHOTOS;
}

function renderPhotoStack(animateTop = true) {
  const stage = document.getElementById('overlappingStage');
  const captionEl = document.getElementById('activePhotoCaption');
  const counterEl = document.getElementById('photoCounter');

  if (!stage || !captionEl || !counterEl) return;

  while (stage.firstChild) {
    stage.removeChild(stage.firstChild);
  }

  const list = getActivePhotos();
  const visibleCount = Math.min(5, list.length);

  for (let offset = visibleCount - 1; offset >= 0; offset--) {
    const idx = (state.stackIndex - offset + list.length) % list.length;
    const item = list[idx];
    const isSensitive = Number(item.is_sensitive) === 1;
    const isRevealed = state.revealedPhotoIds.has(item.id);

    const card = document.createElement('article');
    card.className = 'stacked-photo-card';

    if (isSensitive && !isRevealed) {
      card.classList.add('is-blurred');
    }

    const baseAngle = ((idx * 6.5) % 11) - 5;
    const baseX = ((idx * 14) % 24) - 12;
    const baseY = ((idx * 8) % 18) - 9;

    const fanAngle = (offset - (visibleCount - 1) / 2) * 6;
    const fanX = (offset - (visibleCount - 1) / 2) * 32;
    const fanY = Math.abs(offset - (visibleCount - 1) / 2) * 10;

    const targetTransform = `translate(${baseX}px, ${baseY}px) rotate(${baseAngle}deg)`;
    const hoverTransform = `translate(${fanX}px, ${fanY}px) rotate(${fanAngle}deg)`;

    card.style.zIndex = String(visibleCount - offset);
    card.style.setProperty('--target-transform', targetTransform);
    card.style.setProperty('--target-rot', `${baseAngle}deg`);
    card.style.setProperty('--slam-rot', `${baseAngle * 1.5}deg`);
    card.style.setProperty('--hover-transform', hoverTransform);
    card.style.transform = targetTransform;

    if (offset === 0 && animateTop) {
      card.classList.add('slamming');
    }

    const frameInner = document.createElement('div');
    frameInner.className = 'photo-frame-inner';

    const img = document.createElement('img');
    img.src = item.image_url;
    img.alt = isSensitive && !isRevealed ? 'Evidencia sensible protegida' : item.caption;
    img.loading = 'lazy';
    frameInner.appendChild(img);

    // Escudo de protección si la fotografía contiene material gráfico sensible
    if (isSensitive && !isRevealed) {
      const shield = document.createElement('div');
      shield.className = 'sensitive-shield-overlay';

      const badge = document.createElement('span');
      badge.className = 'sensitive-badge';
      badge.textContent = 'EVIDENCIA SENSIBLE';

      const warningText = document.createElement('p');
      warningText.className = 'sensitive-warning-text';
      warningText.textContent = 'Esta fotografía contiene evidencia gráfica de la causa judicial.';

      const revealBtn = document.createElement('button');
      revealBtn.type = 'button';
      revealBtn.className = 'btn-reveal-photo';
      revealBtn.textContent = 'Mostrar fotografía';
      revealBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.revealedPhotoIds.add(item.id);
        state.isPlaying = false;
        const pauseBtn = document.getElementById('pausePlayBtn');
        if (pauseBtn) pauseBtn.textContent = 'Reanudar secuencia';
        renderPhotoStack(false);
      });

      shield.appendChild(badge);
      shield.appendChild(warningText);
      shield.appendChild(revealBtn);
      frameInner.appendChild(shield);
    } else if (isSensitive && isRevealed) {
      const reblurBtn = document.createElement('button');
      reblurBtn.type = 'button';
      reblurBtn.className = 'btn-reblur-photo';
      reblurBtn.textContent = 'Ocultar imagen';
      reblurBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.revealedPhotoIds.delete(item.id);
        renderPhotoStack(false);
      });
      frameInner.appendChild(reblurBtn);
    }

    const cardFooter = document.createElement('div');
    cardFooter.className = 'photo-card-footer';

    const captionSnippet = document.createElement('span');
    captionSnippet.className = 'photo-card-caption-truncate';
    captionSnippet.textContent = item.caption;

    const tagContainer = document.createElement('div');
    tagContainer.style.display = 'flex';
    tagContainer.style.alignItems = 'center';
    tagContainer.style.gap = '6px';

    const typeTag = document.createElement('span');
    typeTag.className = `photo-card-tag ${isSensitive ? 'is-sensitive-tag' : ''}`;
    typeTag.textContent = isSensitive ? 'EVIDENCIA' : 'DOCUMENTAL';
    tagContainer.appendChild(typeTag);

    // Botón de eliminación si el administrador está logueado
    if (state.adminKey && String(item.id).indexOf('placeholder') === -1) {
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-delete-photo';
      delBtn.textContent = '🗑';
      delBtn.title = 'Eliminar fotografía';
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await deletePhoto(item.id);
      });
      tagContainer.appendChild(delBtn);
    }

    cardFooter.appendChild(captionSnippet);
    cardFooter.appendChild(tagContainer);

    card.appendChild(frameInner);
    card.appendChild(cardFooter);
    stage.appendChild(card);

    if (offset === 0) {
      captionEl.textContent = item.caption;
      counterEl.textContent = `REGISTRO ${idx + 1} DE ${list.length}`;
    }
  }
}

function stepPhoto(delta = 1) {
  const list = getActivePhotos();
  state.stackIndex = (state.stackIndex + delta + list.length) % list.length;
  renderPhotoStack(true);
}

function startStackAutoplay() {
  if (state.stackTimer) clearInterval(state.stackTimer);
  state.stackTimer = setInterval(() => {
    if (state.isPlaying) {
      stepPhoto(1);
    }
  }, 3800);
}

// ================= SECCIÓN 02: EXPEDIENTE JUDICIAL =================

function renderJudicialTimeline() {
  const container = document.getElementById('judicialTimeline');
  const statEl = document.getElementById('statUpdates');

  if (!container) return;

  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  if (statEl) {
    statEl.textContent = `${state.updates.length} actuaciones`;
  }

  const filtered = state.updates.filter((item) => {
    if (state.currentFilter === 'upcoming') return Number(item.is_upcoming) === 1;
    if (state.currentFilter === 'past') return Number(item.is_upcoming) === 0;
    return true;
  });

  if (filtered.length === 0) {
    const emptyNotice = document.createElement('p');
    emptyNotice.className = 'section-subtitle';
    emptyNotice.textContent = 'No hay actuaciones registradas en este criterio de búsqueda todavía.';
    container.appendChild(emptyNotice);
    return;
  }

  filtered.forEach((item) => {
    const isUpcoming = Number(item.is_upcoming) === 1;
    const card = document.createElement('article');
    card.className = `case-card ${isUpcoming ? 'is-upcoming' : ''}`;

    const header = document.createElement('div');
    header.className = 'case-card-header';

    const stageBadge = document.createElement('span');
    stageBadge.className = 'case-stage-badge';
    stageBadge.textContent = item.stage;

    const dateText = document.createElement('span');
    dateText.className = 'case-date-text';
    dateText.textContent = item.event_date;

    header.appendChild(stageBadge);
    header.appendChild(dateText);

    const titleEl = document.createElement('h3');
    titleEl.className = 'case-card-title';
    titleEl.textContent = item.title;

    const descEl = document.createElement('p');
    descEl.className = 'case-card-description';
    descEl.textContent = item.description;

    const footer = document.createElement('div');
    footer.className = 'case-card-footer';

    const expTag = document.createElement('span');
    expTag.className = 'case-exp-tag';
    expTag.textContent = `EXP: ${item.case_number}`;
    footer.appendChild(expTag);

    if (isUpcoming) {
      const upcomingFlag = document.createElement('span');
      upcomingFlag.className = 'upcoming-flag';
      upcomingFlag.textContent = '● PRÓXIMO AVANCE';
      footer.appendChild(upcomingFlag);
    }

    card.appendChild(header);
    card.appendChild(titleEl);
    card.appendChild(descEl);
    card.appendChild(footer);

    // Controles de administración (Editar / Eliminar) visibles directamente en cada tarjeta
    const adminActions = document.createElement('div');
    adminActions.className = 'case-admin-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn-case-action btn-case-edit';
    editBtn.textContent = '✎ Editar';
    editBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!state.adminKey) {
        const key = prompt('Introduce la Clave de Coordinación para editar esta actuación:');
        if (!key) return;
        try {
          const verifyRes = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: { Authorization: `Bearer ${key.trim()}` },
          });
          if (!verifyRes.ok) {
            alert('Clave de coordinación incorrecta.');
            return;
          }
          state.adminKey = key.trim();
          sessionStorage.setItem('tartagal_admin_key', state.adminKey);
          unlockAdminInterface();
        } catch (err) {
          alert('Error al verificar la clave.');
          return;
        }
      }
      openEditModal(item);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-case-action btn-case-delete';
    deleteBtn.textContent = '🗑 Eliminar';
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!state.adminKey) {
        const key = prompt('Introduce la Clave de Coordinación para eliminar esta actuación:');
        if (!key) return;
        try {
          const verifyRes = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: { Authorization: `Bearer ${key.trim()}` },
          });
          if (!verifyRes.ok) {
            alert('Clave de coordinación incorrecta.');
            return;
          }
          state.adminKey = key.trim();
          sessionStorage.setItem('tartagal_admin_key', state.adminKey);
          unlockAdminInterface();
        } catch (err) {
          alert('Error al verificar la clave.');
          return;
        }
      }
      await deleteJudicialUpdate(item.id, item.title);
    });

    adminActions.appendChild(editBtn);
    adminActions.appendChild(deleteBtn);
    card.appendChild(adminActions);

    container.appendChild(card);
  });
}

// ================= SECCIÓN 03: PRENSA Y ENTREVISTAS =================

function renderInterviews() {
  const grid = document.getElementById('interviewsGrid');
  if (!grid) return;

  while (grid.firstChild) {
    grid.removeChild(grid.firstChild);
  }

  if (state.interviews.length === 0) {
    const emptyNotice = document.createElement('p');
    emptyNotice.className = 'section-subtitle';
    emptyNotice.textContent = 'Aún no hay emisiones de medios cargadas. Utiliza el Panel de Carga para registrar notas de YouTube, Instagram o Facebook.';
    grid.appendChild(emptyNotice);
    return;
  }

  state.interviews.forEach((video) => {
    const card = document.createElement('article');
    card.className = 'video-dossier-card';

    const isVertical = Number(video.is_vertical) === 1;
    const frameWrap = document.createElement('div');
    frameWrap.className = `video-frame-container ${isVertical ? 'is-vertical' : ''}`;

    const iframe = document.createElement('iframe');
    iframe.src = video.embed_url;
    iframe.title = video.title;
    iframe.loading = 'lazy';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;

    frameWrap.appendChild(iframe);

    const infoBody = document.createElement('div');
    infoBody.className = 'video-info-body';

    const metaTagline = document.createElement('div');
    metaTagline.className = 'video-meta-tagline';
    metaTagline.textContent = `${video.platform.toUpperCase()} • ${video.media_outlet.toUpperCase()} • ${video.published_date}`;

    const videoTitle = document.createElement('h3');
    videoTitle.className = 'video-entry-title';
    videoTitle.textContent = video.title;

    const fallbackLink = document.createElement('a');
    fallbackLink.href = video.original_url;
    fallbackLink.target = '_blank';
    fallbackLink.rel = 'noopener noreferrer';
    fallbackLink.className = 'video-fallback-link';
    fallbackLink.textContent = `Abrir publicación original en ${video.platform} ↗`;

    infoBody.appendChild(metaTagline);
    infoBody.appendChild(videoTitle);
    infoBody.appendChild(fallbackLink);

    // Botón de eliminación si el administrador está logueado
    if (state.adminKey) {
      const deleteVidBtn = document.createElement('button');
      deleteVidBtn.type = 'button';
      deleteVidBtn.className = 'btn-delete-interview';
      deleteVidBtn.textContent = '🗑 Eliminar entrevista';
      deleteVidBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await deleteInterview(video.id, video.title);
      });
      infoBody.appendChild(deleteVidBtn);
    }

    card.appendChild(frameWrap);
    card.appendChild(infoBody);
    grid.appendChild(card);
  });
}

// ================= MODAL Y ACCIONES DE EDICIÓN / ELIMINACIÓN =================

function openEditModal(item) {
  const modal = document.getElementById('editModal');
  const backdrop = document.getElementById('editModalBackdrop');
  const feedback = document.getElementById('editFeedback');

  document.getElementById('editUpdateId').value = item.id;
  document.getElementById('editCaseNumber').value = item.case_number;
  document.getElementById('editStage').value = item.stage;
  document.getElementById('editEventDate').value = item.event_date;
  document.getElementById('editTitle').value = item.title;
  document.getElementById('editDescription').value = item.description;
  document.getElementById('editIsUpcoming').checked = Number(item.is_upcoming) === 1;

  if (feedback) {
    feedback.textContent = '';
    feedback.className = 'feedback-notification';
  }

  if (modal && backdrop) {
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    backdrop.classList.add('is-open');
    backdrop.setAttribute('aria-hidden', 'false');
  }
}

function closeEditModal() {
  const modal = document.getElementById('editModal');
  const backdrop = document.getElementById('editModalBackdrop');
  if (modal && backdrop) {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    backdrop.classList.remove('is-open');
    backdrop.setAttribute('aria-hidden', 'true');
  }
}

async function deleteJudicialUpdate(id, title) {
  if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente la actuación:\n"${title}"?\n\nEsta acción no se puede deshacer.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/judicial/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${state.adminKey}`,
      },
    });

    const data = await res.json();
    if (res.ok) {
      await fetchCampaignData();
    } else {
      alert(data.error || 'No se pudo eliminar la actuación.');
    }
  } catch (err) {
    alert('Error de conexión al eliminar la actuación judicial.');
  }
}

async function deletePhoto(id) {
  if (!confirm('¿Deseas eliminar esta fotografía del archivo? Esta acción es irreversible.')) {
    return;
  }

  try {
    const res = await fetch(`/api/photos/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${state.adminKey}`,
      },
    });

    const data = await res.json();
    if (res.ok) {
      state.stackIndex = 0;
      await fetchCampaignData();
    } else {
      alert(data.error || 'No se pudo eliminar la fotografía.');
    }
  } catch (err) {
    alert('Error de conexión al eliminar la fotografía.');
  }
}

async function deleteInterview(id, title) {
  if (!confirm(`¿Deseas eliminar la entrevista:\n"${title}"?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/interviews/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${state.adminKey}`,
      },
    });

    const data = await res.json();
    if (res.ok) {
      await fetchCampaignData();
    } else {
      alert(data.error || 'No se pudo eliminar la entrevista.');
    }
  } catch (err) {
    alert('Error de conexión al eliminar la entrevista.');
  }
}

// ================= CARGA DE DATOS Y GESTIÓN DE API =================

async function fetchPetitionData() {
  try {
    const res = await fetch('/api/petition');
    if (!res.ok) return;
    const data = await res.json();
    state.petition = data;

    const headingEl = document.getElementById('petitionHeading');
    const descEl = document.getElementById('petitionDescription');
    const linkBtn = document.getElementById('petitionLinkBtn');

    if (headingEl && data.title) headingEl.textContent = data.title;
    if (descEl && data.description) descEl.textContent = data.description;
    if (linkBtn && data.petition_url) {
      linkBtn.href = data.petition_url;
      linkBtn.setAttribute('href', data.petition_url);
    }

    // Rellenar formulario de administración si existe
    const titleInput = document.getElementById('petitionTitleInput');
    const urlInput = document.getElementById('petitionUrlInput');
    const descInput = document.getElementById('petitionDescInput');

    if (titleInput && data.title) titleInput.value = data.title;
    if (urlInput && data.petition_url) urlInput.value = data.petition_url;
    if (descInput && data.description) descInput.value = data.description;
  } catch (err) {
    console.warn('No se pudo cargar la información de la petición:', err);
  }
}

async function fetchCampaignData() {
  try {
    const res = await fetch('/api/campaign');
    if (!res.ok) throw new Error('Error al consultar el servidor');
    const data = await res.json();

    state.updates = data.updates || [];
    state.photos = data.photos || [];
    state.interviews = data.interviews || [];

    renderPhotoStack(false);
    renderJudicialTimeline();
    renderInterviews();
  } catch (err) {
    console.error('Error cargando datos de la campaña:', err);
  }
}

function unlockAdminInterface() {
  const formsContainer = document.getElementById('adminFormsContainer');
  const dotIndicator = document.getElementById('adminDot');
  const feedback = document.getElementById('authFeedback');
  const sessionBar = document.getElementById('sessionBar');

  if (formsContainer) formsContainer.classList.remove('is-locked');
  if (dotIndicator) dotIndicator.classList.add('unlocked');
  if (sessionBar) sessionBar.style.display = 'flex';
  if (feedback) {
    feedback.className = 'feedback-notification is-success';
    feedback.textContent = 'Sesión de coordinación verificada y activa.';
  }

  // Refrescar vistas para mostrar botones de edición y eliminación
  renderJudicialTimeline();
  renderInterviews();
  renderPhotoStack(false);
}

function lockAdminInterface() {
  state.adminKey = '';
  sessionStorage.removeItem('tartagal_admin_key');

  const formsContainer = document.getElementById('adminFormsContainer');
  const dotIndicator = document.getElementById('adminDot');
  const feedback = document.getElementById('authFeedback');
  const sessionBar = document.getElementById('sessionBar');
  const keyInput = document.getElementById('adminKeyInput');

  if (formsContainer) formsContainer.classList.add('is-locked');
  if (dotIndicator) dotIndicator.classList.remove('unlocked');
  if (sessionBar) sessionBar.style.display = 'none';
  if (keyInput) keyInput.value = '';
  if (feedback) {
    feedback.className = 'feedback-notification';
    feedback.textContent = 'Sesión finalizada.';
  }

  renderJudicialTimeline();
  renderInterviews();
  renderPhotoStack(false);
}

// ================= INICIALIZACIÓN Y EVENT LISTENERS =================

document.addEventListener('DOMContentLoaded', () => {
  fetchCampaignData();
  fetchPetitionData();
  startStackAutoplay();

  if (state.adminKey) {
    unlockAdminInterface();
  }

  // Controles de la pila fotográfica
  const nextBtn = document.getElementById('nextPhotoBtn');
  const prevBtn = document.getElementById('prevPhotoBtn');
  const pausePlayBtn = document.getElementById('pausePlayBtn');

  if (nextBtn) nextBtn.addEventListener('click', () => stepPhoto(1));
  if (prevBtn) prevBtn.addEventListener('click', () => stepPhoto(-1));
  if (pausePlayBtn) {
    pausePlayBtn.addEventListener('click', () => {
      state.isPlaying = !state.isPlaying;
      pausePlayBtn.textContent = state.isPlaying ? 'Pausar secuencia' : 'Reanudar secuencia';
    });
  }

  // Filtros de actuaciones judiciales
  const filterPills = document.querySelectorAll('.pill-filter');
  filterPills.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterPills.forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      state.currentFilter = btn.dataset.filter || 'all';
      renderJudicialTimeline();
    });
  });

  // Apertura y cierre del drawer lateral
  const drawer = document.getElementById('adminDrawer');
  const backdrop = document.getElementById('drawerBackdrop');
  const openDrawerBtn = document.getElementById('toggleAdminBtn');
  const closeDrawerBtn = document.getElementById('closeDrawerBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  const openDrawer = () => {
    if (drawer && backdrop) {
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      backdrop.classList.add('is-open');
      backdrop.setAttribute('aria-hidden', 'false');
      if (openDrawerBtn) openDrawerBtn.setAttribute('aria-expanded', 'true');
    }
  };

  const closeDrawer = () => {
    if (drawer && backdrop) {
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      backdrop.classList.remove('is-open');
      backdrop.setAttribute('aria-hidden', 'true');
      if (openDrawerBtn) openDrawerBtn.setAttribute('aria-expanded', 'false');
    }
  };

  if (openDrawerBtn) openDrawerBtn.addEventListener('click', openDrawer);
  if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeDrawer);
  if (backdrop) backdrop.addEventListener('click', closeDrawer);
  if (logoutBtn) logoutBtn.addEventListener('click', lockAdminInterface);

  // Modal de edición de actuaciones
  const closeEditModalBtn = document.getElementById('closeEditModalBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const editModalBackdrop = document.getElementById('editModalBackdrop');

  if (closeEditModalBtn) closeEditModalBtn.addEventListener('click', closeEditModal);
  if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditModal);
  if (editModalBackdrop) editModalBackdrop.addEventListener('click', closeEditModal);

  // Selector de pestañas del panel de administración
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanes = document.querySelectorAll('.tab-pane-form');

  tabButtons.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabButtons.forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tabPanes.forEach((pane) => pane.classList.remove('active'));

      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      const targetTab = tab.dataset.tab;
      const targetPane = document.querySelector(`.tab-pane-form[data-tab-panel="${targetTab}"]`);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Autenticación administrativa
  const authForm = document.getElementById('authForm');
  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('adminKeyInput');
      const feedback = document.getElementById('authFeedback');
      if (!input || !feedback) return;

      const key = input.value.trim();
      feedback.className = 'feedback-notification';
      feedback.textContent = 'Verificando clave...';

      try {
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}` },
        });

        if (res.ok) {
          state.adminKey = key;
          sessionStorage.setItem('tartagal_admin_key', key);
          unlockAdminInterface();
        } else {
          const data = await res.json();
          feedback.className = 'feedback-notification is-error';
          feedback.textContent = data.error || 'Clave de coordinación inválida.';
        }
      } catch (err) {
        feedback.className = 'feedback-notification is-error';
        feedback.textContent = 'Error de conexión con el servidor.';
      }
    });
  }

  // Formulario 1: Nueva actuación judicial
  const formJudicial = document.getElementById('formJudicial');
  if (formJudicial) {
    formJudicial.addEventListener('submit', async (e) => {
      e.preventDefault();
      const feedback = document.getElementById('uploadFeedback');
      if (feedback) {
        feedback.className = 'feedback-notification';
        feedback.textContent = 'Registrando actuación en el expediente...';
      }

      const fd = new FormData(formJudicial);
      const payload = {
        case_number: String(fd.get('case_number') || ''),
        stage: String(fd.get('stage') || ''),
        event_date: String(fd.get('event_date') || ''),
        title: String(fd.get('title') || ''),
        description: String(fd.get('description') || ''),
        is_upcoming: fd.get('is_upcoming') === 'on',
      };

      try {
        const res = await fetch('/api/judicial', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.adminKey}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (res.ok) {
          formJudicial.reset();
          if (feedback) {
            feedback.className = 'feedback-notification is-success';
            feedback.textContent = 'Actuación judicial incorporada con éxito al expediente.';
          }
          await fetchCampaignData();
        } else {
          if (feedback) {
            feedback.className = 'feedback-notification is-error';
            feedback.textContent = data.error || 'No se pudo guardar la actuación.';
          }
        }
      } catch (err) {
        if (feedback) {
          feedback.className = 'feedback-notification is-error';
          feedback.textContent = 'Error de comunicación al guardar.';
        }
      }
    });
  }

  // Formulario de edición de actuación judicial
  const formEditJudicial = document.getElementById('formEditJudicial');
  if (formEditJudicial) {
    formEditJudicial.addEventListener('submit', async (e) => {
      e.preventDefault();
      const feedback = document.getElementById('editFeedback');
      if (feedback) {
        feedback.className = 'feedback-notification';
        feedback.textContent = 'Guardando cambios en el expediente...';
      }

      const fd = new FormData(formEditJudicial);
      const id = fd.get('id');
      const payload = {
        case_number: String(fd.get('case_number') || ''),
        stage: String(fd.get('stage') || ''),
        event_date: String(fd.get('event_date') || ''),
        title: String(fd.get('title') || ''),
        description: String(fd.get('description') || ''),
        is_upcoming: fd.get('is_upcoming') === 'on',
      };

      try {
        const res = await fetch(`/api/judicial/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.adminKey}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (res.ok) {
          if (feedback) {
            feedback.className = 'feedback-notification is-success';
            feedback.textContent = 'Actuación judicial actualizada correctamente.';
          }
          setTimeout(() => {
            closeEditModal();
          }, 500);
          await fetchCampaignData();
        } else {
          if (feedback) {
            feedback.className = 'feedback-notification is-error';
            feedback.textContent = data.error || 'No se pudo actualizar la actuación.';
          }
        }
      } catch (err) {
        if (feedback) {
          feedback.className = 'feedback-notification is-error';
          feedback.textContent = 'Error de comunicación al actualizar.';
        }
      }
    });
  }

  // Formulario 2: Subida de fotografía
  const formPhoto = document.getElementById('formPhoto');
  if (formPhoto) {
    formPhoto.addEventListener('submit', async (e) => {
      e.preventDefault();
      const feedback = document.getElementById('uploadFeedback');
      if (feedback) {
        feedback.className = 'feedback-notification';
        feedback.textContent = 'Subiendo y optimizando fotografía en Cloudinary...';
      }

      const fd = new FormData(formPhoto);

      try {
        const res = await fetch('/api/photos', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${state.adminKey}`,
          },
          body: fd,
        });

        const data = await res.json();
        if (res.ok) {
          formPhoto.reset();
          state.stackIndex = 0;
          if (feedback) {
            feedback.className = 'feedback-notification is-success';
            feedback.textContent = 'Fotografía incorporada a la mesa documental.';
          }
          await fetchCampaignData();
        } else {
          if (feedback) {
            feedback.className = 'feedback-notification is-error';
            feedback.textContent = data.error || 'Error al subir la fotografía.';
          }
        }
      } catch (err) {
        if (feedback) {
          feedback.className = 'feedback-notification is-error';
          feedback.textContent = 'Error de conexión al cargar la fotografía.';
        }
      }
    });
  }

  // Formulario 3: Registro de entrevista / video
  const formInterview = document.getElementById('formInterview');
  if (formInterview) {
    formInterview.addEventListener('submit', async (e) => {
      e.preventDefault();
      const feedback = document.getElementById('uploadFeedback');
      if (feedback) {
        feedback.className = 'feedback-notification';
        feedback.textContent = 'Analizando y registrando enlace multimedia...';
      }

      const fd = new FormData(formInterview);
      const payload = {
        media_outlet: String(fd.get('media_outlet') || ''),
        title: String(fd.get('title') || ''),
        video_url: String(fd.get('video_url') || ''),
        published_date: String(fd.get('published_date') || ''),
      };

      try {
        const res = await fetch('/api/interviews', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.adminKey}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (res.ok) {
          formInterview.reset();
          if (feedback) {
            feedback.className = 'feedback-notification is-success';
            feedback.textContent = 'Entrevista registrada y publicada en la plataforma.';
          }
          await fetchCampaignData();
        } else {
          if (feedback) {
            feedback.className = 'feedback-notification is-error';
            feedback.textContent = data.error || 'Error al publicar la entrevista.';
          }
        }
      } catch (err) {
        if (feedback) {
          feedback.className = 'feedback-notification is-error';
          feedback.textContent = 'Error de conexión al guardar el registro audiovisual.';
        }
      }
    });
  }

  // Botón para compartir y copiar enlace de la petición de Change.org
  const sharePetitionBtn = document.getElementById('sharePetitionBtn');
  if (sharePetitionBtn) {
    sharePetitionBtn.addEventListener('click', async () => {
      const linkBtn = document.getElementById('petitionLinkBtn');
      const url = (linkBtn && linkBtn.href) ? linkBtn.href : 'https://www.change.org/se-investigue-orden-de-matar-gatos';
      const feedback = document.getElementById('shareFeedback');

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
        } else {
          const tempInput = document.createElement('input');
          tempInput.value = url;
          document.body.appendChild(tempInput);
          tempInput.select();
          document.execCommand('copy');
          document.body.removeChild(tempInput);
        }

        if (feedback) {
          feedback.textContent = '✓ ¡Enlace copiado al portapapeles! Listo para compartir en redes.';
          setTimeout(() => {
            feedback.textContent = '';
          }, 4500);
        }
      } catch (err) {
        if (feedback) {
          feedback.textContent = `Enlace: ${url}`;
        }
      }
    });
  }

  // Formulario 4: Actualización de la Petición Change.org
  const formPetition = document.getElementById('formPetition');
  if (formPetition) {
    formPetition.addEventListener('submit', async (e) => {
      e.preventDefault();
      const feedback = document.getElementById('uploadFeedback');
      if (feedback) {
        feedback.className = 'feedback-notification';
        feedback.textContent = 'Actualizando datos de la petición en el servidor...';
      }

      const fd = new FormData(formPetition);
      const payload = {
        title: String(fd.get('title') || '').trim(),
        petition_url: String(fd.get('petition_url') || '').trim(),
        description: String(fd.get('description') || '').trim(),
      };

      try {
        const res = await fetch('/api/petition', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.adminKey}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (res.ok) {
          if (feedback) {
            feedback.className = 'feedback-notification is-success';
            feedback.textContent = '¡Petición de Change.org actualizada exitosamente!';
          }
          await fetchPetitionData();
        } else {
          if (feedback) {
            feedback.className = 'feedback-notification is-error';
            feedback.textContent = data.error || 'No se pudo actualizar la petición.';
          }
        }
      } catch (err) {
        if (feedback) {
          feedback.className = 'feedback-notification is-error';
          feedback.textContent = 'Error de conexión al actualizar la petición.';
        }
      }
    });
  }
});
