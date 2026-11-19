const { createClient } = require('@libsql/client');

const dbUrl = process.env.TURSO_DATABASE_URL || 'file:local.db';
const dbAuthToken = process.env.TURSO_AUTH_TOKEN || undefined;

const db = createClient({
  url: dbUrl,
  authToken: dbAuthToken,
});

async function initDatabase() {
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS judicial_updates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_number TEXT NOT NULL,
        stage TEXT NOT NULL,
        event_date TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        is_upcoming INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS gallery_photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_url TEXT NOT NULL,
        public_id TEXT NOT NULL,
        caption TEXT NOT NULL,
        is_sensitive INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS interviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        media_outlet TEXT NOT NULL,
        title TEXT NOT NULL,
        platform TEXT NOT NULL,
        embed_url TEXT NOT NULL,
        original_url TEXT NOT NULL,
        is_vertical INTEGER NOT NULL DEFAULT 0,
        published_date TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS campaign_petition (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        petition_url TEXT NOT NULL,
        description TEXT NOT NULL,
        target_signatures INTEGER NOT NULL DEFAULT 5000,
        is_active INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    ],
    'write'
  );

  // Inicialización de la petición de firmas en Change.org si la tabla está vacía
  const petitionCount = await db.execute('SELECT COUNT(*) AS total FROM campaign_petition');
  if (Number(petitionCount.rows[0]?.total || 0) === 0) {
    await db.execute({
      sql: `INSERT INTO campaign_petition (title, petition_url, description, target_signatures, is_active)
            VALUES (?, ?, ?, ?, ?)`,
      args: [
        'Exigimos que se investigue la orden de matar y envenenar gatos en Punto Norte, Tartagal',
        'https://www.change.org/se-investigue-orden-de-matar-gatos',
        'Los vecinos autoconvocados exigimos que la justicia actúe con celeridad. Cada firma suma presión ciudadana ante el Ministerio Público Fiscal de Salta y la Procuración General para que se asigne fiscal, se ordenen peritajes toxicológicos urgentes y se condene a los responsables bajo la Ley Nacional 14.346.',
        5000,
        1,
      ],
    });
  }
}

module.exports = { db, initDatabase };
