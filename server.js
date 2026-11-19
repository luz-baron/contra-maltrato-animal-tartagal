require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const { v2: cloudinary } = require('cloudinary');
const { z } = require('zod');
const { db, initDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_ACCESS_KEY || 'TartagalJusticia2026_ClaveSegura!';

if (!process.env.ADMIN_ACCESS_KEY) {
  console.warn('[AVISO] ADMIN_ACCESS_KEY no está definida en .env. Se utiliza clave predeterminada de desarrollo.');
} else if (process.env.ADMIN_ACCESS_KEY.length < 12) {
  console.warn('[AVISO] Se recomienda que ADMIN_ACCESS_KEY contenga al menos 12 caracteres.');
}

// Configuración para proxy inverso en Render / Railway / Koyeb
app.set('trust proxy', 1);

// Configuración de Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Cabeceras de seguridad CSP estrictas (Cloudinary, Google Fonts, YouTube, Instagram, Facebook)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
        frameSrc: [
          'https://www.youtube.com',
          'https://www.youtube-nocookie.com',
          'https://www.instagram.com',
          'https://www.facebook.com',
          'https://web.facebook.com',
        ],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Limitadores de tasa de peticiones (express-rate-limit)
const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Demasiadas operaciones de escritura. Intenta nuevamente en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Verificación de credencial en tiempo constante (protección contra timing attacks)
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({ error: 'Se requiere clave de coordinación.' });
  }

  const hashProvided = crypto.createHash('sha256').update(token).digest();
  const hashExpected = crypto.createHash('sha256').update(ADMIN_KEY).digest();

  if (!crypto.timingSafeEqual(hashProvided, hashExpected)) {
    return res.status(403).json({ error: 'Clave de coordinación inválida.' });
  }

  next();
}

// Esquemas de validación Zod con límites generosos para expedientes judiciales reales
const judicialSchema = z.object({
  case_number: z.string().trim().min(1, 'Ingresa el número de expediente').max(250, 'El número de expediente puede tener hasta 250 caracteres'),
  stage: z.string().trim().min(2, 'Ingresa la fiscalía o etapa procesal').max(250, 'La etapa procesal puede tener hasta 250 caracteres'),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (formato requerido: YYYY-MM-DD)'),
  title: z.string().trim().min(3, 'El título debe tener al menos 3 caracteres').max(350, 'El título puede tener hasta 350 caracteres'),
  description: z.string().trim().min(5, 'La descripción debe tener al menos 5 caracteres').max(10000, 'La descripción puede tener hasta 10.000 caracteres'),
  is_upcoming: z.boolean().optional().default(false),
});

const interviewSchema = z.object({
  media_outlet: z.string().trim().min(2).max(120),
  title: z.string().trim().min(3).max(250),
  video_url: z.string().trim().url('Debe ser una URL válida que empiece con https://'),
  published_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (formato requerido: YYYY-MM-DD)'),
});

const petitionSchema = z.object({
  title: z.string().trim().min(5, 'El título debe tener al menos 5 caracteres').max(300, 'Máximo 300 caracteres'),
  petition_url: z.string().trim().url('Debe ser una URL válida').refine((url) => {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
      return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && host === 'change.org';
    } catch {
      return false;
    }
  }, 'El enlace debe pertenecer al dominio oficial de Change.org (https://www.change.org/...)'),
  description: z.string().trim().min(10, 'La descripción debe tener al menos 10 caracteres').max(3000, 'Máximo 3000 caracteres'),
  target_signatures: z.coerce.number().int().positive().optional().default(5000),
  is_active: z.boolean().optional().default(true),
});

// Parser seguro para videos sociales (YouTube, Instagram y Facebook)
function parseSafeSocialVideo(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

    // 1. YouTube (videos estándar, Shorts y youtu.be)
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const v = parsed.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
        return {
          platform: 'YouTube',
          embedUrl: `https://www.youtube-nocookie.com/embed/${v}`,
          originalUrl: `https://www.youtube.com/watch?v=${v}`,
          isVertical: 0,
        };
      }
      const shortsMatch = parsed.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (shortsMatch) {
        return {
          platform: 'YouTube Shorts',
          embedUrl: `https://www.youtube-nocookie.com/embed/${shortsMatch[1]}`,
          originalUrl: `https://www.youtube.com/shorts/${shortsMatch[1]}`,
          isVertical: 1,
        };
      }
    }

    if (host === 'youtu.be') {
      const id = parsed.pathname.slice(1).split('/')[0];
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) {
        return {
          platform: 'YouTube',
          embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
          originalUrl: `https://www.youtube.com/watch?v=${id}`,
          isVertical: 0,
        };
      }
    }

    // 2. Instagram (Posts y Reels)
    if (host === 'instagram.com' || host === 'm.instagram.com') {
      const igMatch = parsed.pathname.match(/^\/(p|reel|reels)\/([a-zA-Z0-9_-]{5,40})/);
      if (igMatch) {
        const type = igMatch[1] === 'p' ? 'p' : 'reel';
        const code = igMatch[2];
        return {
          platform: 'Instagram',
          embedUrl: `https://www.instagram.com/${type}/${code}/embed/`,
          originalUrl: `https://www.instagram.com/${type}/${code}/`,
          isVertical: 1,
        };
      }
    }

    // 3. Facebook (Videos, Reels y Watch)
    if (
      host === 'facebook.com' ||
      host === 'm.facebook.com' ||
      host === 'web.facebook.com' ||
      host === 'fb.watch'
    ) {
      const isReel = parsed.pathname.includes('/reel/');
      const cleanUrl = new URL(parsed.origin + parsed.pathname);
      if (parsed.searchParams.has('v')) {
        cleanUrl.searchParams.set('v', parsed.searchParams.get('v'));
      }
      const finalFbUrl = cleanUrl.toString();

      return {
        platform: 'Facebook',
        embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(finalFbUrl)}&show_text=false&width=500`,
        originalUrl: finalFbUrl,
        isVertical: isReel ? 1 : 0,
      };
    }

    return null;
  } catch {
    return null;
  }
}

// Configuración de multer y validación binaria de magic-bytes
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024, files: 1 }, // Máximo 6MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(new Error('Formato no permitido. Solo se aceptan imágenes JPG, PNG o WEBP.'));
    }
    cb(null, true);
  },
});

function hasValidImageMagicBytes(buffer, mimetype) {
  if (!buffer || buffer.length < 12) return false;
  // JPEG: FF D8 FF
  if (mimetype === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  // PNG: 89 50 4E 47
  if (mimetype === 'image/png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  // WEBP: RIFF....WEBP
  if (mimetype === 'image/webp') {
    return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  }
  return false;
}

function uploadBufferToCloudinary(buffer) {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Faltan configurar las credenciales de Cloudinary en las variables de entorno (.env).');
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'contra-maltrato-animal-tartagal',
        resource_type: 'image',
        transformation: [{ width: 1400, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

// ================= RUTAS DE LA API =================

// Endpoint de monitoreo liviano (UptimeRobot / Render keep-alive)
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Verificación de clave administrativa
app.post('/api/auth/verify', writeLimiter, requireAdmin, (_req, res) => {
  res.json({ ok: true, message: 'Autenticación exitosa.' });
});

// Obtención de todos los datos públicos de la campaña
app.get('/api/campaign', readLimiter, async (_req, res, next) => {
  try {
    const [updatesRes, photosRes, interviewsRes] = await Promise.all([
      db.execute('SELECT * FROM judicial_updates ORDER BY event_date DESC, id DESC'),
      db.execute('SELECT * FROM gallery_photos ORDER BY id DESC LIMIT 50'),
      db.execute('SELECT * FROM interviews ORDER BY published_date DESC, id DESC'),
    ]);

    res.json({
      updates: updatesRes.rows,
      photos: photosRes.rows,
      interviews: interviewsRes.rows,
    });
  } catch (err) {
    next(err);
  }
});

// 1. Creación de actualización judicial
app.post('/api/judicial', writeLimiter, requireAdmin, async (req, res, next) => {
  try {
    const parsed = judicialSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { case_number, stage, event_date, title, description, is_upcoming } = parsed.data;
    const insertRes = await db.execute({
      sql: `INSERT INTO judicial_updates (case_number, stage, event_date, title, description, is_upcoming)
            VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
      args: [case_number, stage, event_date, title, description, is_upcoming ? 1 : 0],
    });

    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    next(err);
  }
});

// 2. Edición de actualización judicial existente
app.put('/api/judicial/:id', writeLimiter, requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ error: 'ID de actuación judicial inválido.' });
    }

    const parsed = judicialSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { case_number, stage, event_date, title, description, is_upcoming } = parsed.data;
    const updateRes = await db.execute({
      sql: `UPDATE judicial_updates 
            SET case_number = ?, stage = ?, event_date = ?, title = ?, description = ?, is_upcoming = ?
            WHERE id = ? RETURNING *`,
      args: [case_number, stage, event_date, title, description, is_upcoming ? 1 : 0, id],
    });

    if (!updateRes.rows || updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontró la actuación judicial para actualizar.' });
    }

    res.json(updateRes.rows[0]);
  } catch (err) {
    next(err);
  }
});

// 3. Eliminación de actuación judicial
app.delete('/api/judicial/:id', writeLimiter, requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ error: 'ID de actuación judicial inválido.' });
    }

    const deleteRes = await db.execute({
      sql: `DELETE FROM judicial_updates WHERE id = ?`,
      args: [id],
    });

    if (deleteRes.rowsAffected === 0) {
      return res.status(404).json({ error: 'No se encontró la actuación judicial para eliminar.' });
    }

    res.json({ ok: true, message: 'Actuación judicial eliminada con éxito.' });
  } catch (err) {
    next(err);
  }
});

// Subida de fotografías documentales
app.post('/api/photos', writeLimiter, requireAdmin, upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Adjunta un archivo de imagen válido.' });
    }
    if (!hasValidImageMagicBytes(req.file.buffer, req.file.mimetype)) {
      return res.status(400).json({ error: 'El archivo está dañado o su cabecera binaria no coincide con una imagen legítima.' });
    }

    const captionParsed = z.string().trim().min(3).max(250).safeParse(req.body.caption);
    if (!captionParsed.success) {
      return res.status(400).json({ error: 'El epígrafe debe tener entre 3 y 250 caracteres.' });
    }

    const isSensitive = req.body.is_sensitive === 'true' || req.body.is_sensitive === 'on' || req.body.is_sensitive === '1' ? 1 : 0;

    const cloudResult = await uploadBufferToCloudinary(req.file.buffer);

    const insertRes = await db.execute({
      sql: `INSERT INTO gallery_photos (image_url, public_id, caption, is_sensitive)
            VALUES (?, ?, ?, ?) RETURNING *`,
      args: [cloudResult.secure_url, cloudResult.public_id, captionParsed.data, isSensitive],
    });

    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Eliminación de fotografía
app.delete('/api/photos/:id', writeLimiter, requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ error: 'ID de fotografía inválido.' });
    }

    const photoRes = await db.execute({
      sql: `SELECT public_id FROM gallery_photos WHERE id = ?`,
      args: [id],
    });

    if (photoRes.rows && photoRes.rows.length > 0) {
      const publicId = photoRes.rows[0].public_id;
      if (publicId && process.env.CLOUDINARY_CLOUD_NAME) {
        try {
          await cloudinary.uploader.destroy(publicId);
        } catch (e) {
          console.warn('No se pudo borrar de Cloudinary:', e);
        }
      }
    }

    await db.execute({
      sql: `DELETE FROM gallery_photos WHERE id = ?`,
      args: [id],
    });

    res.json({ ok: true, message: 'Fotografía eliminada correctamente.' });
  } catch (err) {
    next(err);
  }
});

// Publicación de entrevistas y registros en medios
app.post('/api/interviews', writeLimiter, requireAdmin, async (req, res, next) => {
  try {
    const parsed = interviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const videoData = parseSafeSocialVideo(parsed.data.video_url);
    if (!videoData) {
      return res.status(400).json({
        error: 'Enlace no admitido. Proporciona una URL válida de YouTube (video o Shorts), Instagram (Post o Reel) o Facebook.',
      });
    }

    const insertRes = await db.execute({
      sql: `INSERT INTO interviews (media_outlet, title, platform, embed_url, original_url, is_vertical, published_date)
            VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      args: [
        parsed.data.media_outlet,
        parsed.data.title,
        videoData.platform,
        videoData.embedUrl,
        videoData.originalUrl,
        videoData.isVertical,
        parsed.data.published_date,
      ],
    });

    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Eliminación de entrevista
app.delete('/api/interviews/:id', writeLimiter, requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ error: 'ID de entrevista inválido.' });
    }

    await db.execute({
      sql: `DELETE FROM interviews WHERE id = ?`,
      args: [id],
    });

    res.json({ ok: true, message: 'Entrevista eliminada correctamente.' });
  } catch (err) {
    next(err);
  }
});

// ================= RUTAS DE PETICIÓN CHANGE.ORG =================

// Consulta pública de la petición de firmas
app.get('/api/petition', readLimiter, async (_req, res, next) => {
  try {
    const result = await db.execute('SELECT * FROM campaign_petition ORDER BY id ASC LIMIT 1');
    if (!result.rows || result.rows.length === 0) {
      return res.json({
        title: 'Exigimos que se investigue la orden de matar y envenenar gatos en Punto Norte, Tartagal',
        petition_url: 'https://www.change.org/se-investigue-orden-de-matar-gatos',
        description: 'Los vecinos autoconvocados exigimos que la justicia actúe con celeridad. Cada firma suma presión ciudadana ante el Ministerio Público Fiscal de Salta y la Procuración General para que se asigne fiscal, se ordenen peritajes toxicológicos urgentes y se condene a los responsables bajo la Ley Nacional 14.346.',
        target_signatures: 5000,
        is_active: 1,
      });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Actualización administrativa de la petición
app.put('/api/petition', writeLimiter, requireAdmin, async (req, res, next) => {
  try {
    const parsed = petitionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { title, petition_url, description, target_signatures, is_active } = parsed.data;

    const countRes = await db.execute('SELECT id FROM campaign_petition ORDER BY id ASC LIMIT 1');
    if (countRes.rows && countRes.rows.length > 0) {
      const id = countRes.rows[0].id;
      const updateRes = await db.execute({
        sql: `UPDATE campaign_petition 
              SET title = ?, petition_url = ?, description = ?, target_signatures = ?, is_active = ?, updated_at = datetime('now')
              WHERE id = ? RETURNING *`,
        args: [title, petition_url, description, target_signatures || 5000, is_active ? 1 : 0, id],
      });
      return res.json(updateRes.rows[0]);
    } else {
      const insertRes = await db.execute({
        sql: `INSERT INTO campaign_petition (title, petition_url, description, target_signatures, is_active)
              VALUES (?, ?, ?, ?, ?) RETURNING *`,
        args: [title, petition_url, description, target_signatures || 5000, is_active ? 1 : 0],
      });
      return res.status(201).json(insertRes.rows[0]);
    }
  } catch (err) {
    next(err);
  }
});

// Manejador centralizado de errores
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Error en la subida del archivo: ${err.message}` });
  }
  console.error('[SERVER ERROR]:', err);
  res.status(500).json({ error: err.message || 'Ocurrió un error inesperado en el servidor.' });
});

// Inicialización de la base de datos y arranque del servidor HTTP
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[INFO] Servidor activo en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[FATAL] No se pudo inicializar la base de datos:', err);
    process.exit(1);
  });
