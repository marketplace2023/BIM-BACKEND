require('dotenv').config();
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'marketplace_master',
  });

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@marketplace.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin1234!';
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminName = process.env.ADMIN_NAME || 'Marketplace Admin';

  const [tenantRows] = await connection.execute(
    "SELECT id FROM tenants WHERE slug = 'marketplace-master' LIMIT 1",
  );

  let tenantId = tenantRows[0] && tenantRows[0].id;

  if (!tenantId) {
    const [insertTenant] = await connection.execute(
      "INSERT INTO tenants (name, slug, status) VALUES (?, ?, 'active')",
      ['Marketplace Master', 'marketplace-master'],
    );
    tenantId = String(insertTenant.insertId);
  }

  const [roleRows] = await connection.execute(
    "SELECT id FROM user_roles WHERE code = 'admin' LIMIT 1",
  );

  let roleId = roleRows[0] && roleRows[0].id;

  if (!roleId) {
    const [insertRole] = await connection.execute(
      "INSERT INTO user_roles (code, name) VALUES ('admin', 'Administrator')",
    );
    roleId = String(insertRole.insertId);
  }

  const [userRows] = await connection.execute(
    'SELECT id, partner_id FROM res_users WHERE email = ? LIMIT 1',
    [adminEmail],
  );

  let userId;
  let partnerId;

  if (userRows[0]) {
    userId = String(userRows[0].id);
    partnerId = String(userRows[0].partner_id);

    await connection.execute(
      'UPDATE res_users SET username = ?, is_active = 1, is_email_verified = 1, kyc_status = ?, password_hash = ? WHERE id = ?',
      [adminUsername, 'approved', await bcrypt.hash(adminPassword, 12), userId],
    );
  } else {
    const [insertPartner] = await connection.execute(
      'INSERT INTO res_partner (tenant_id, entity_type, name, email, x_partner_role, x_verification_status, is_company) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [tenantId, 'customer', adminName, adminEmail, 'admin', 'approved'],
    );
    partnerId = String(insertPartner.insertId);

    const [insertUser] = await connection.execute(
      'INSERT INTO res_users (tenant_id, partner_id, username, email, password_hash, is_active, is_email_verified, kyc_status) VALUES (?, ?, ?, ?, ?, 1, 1, ?)',
      [
        tenantId,
        partnerId,
        adminUsername,
        adminEmail,
        await bcrypt.hash(adminPassword, 12),
        'approved',
      ],
    );
    userId = String(insertUser.insertId);
  }

  const [assignmentRows] = await connection.execute(
    'SELECT id FROM user_role_assignments WHERE user_id = ? AND role_id = ? AND partner_id = ? LIMIT 1',
    [userId, roleId, partnerId],
  );

  if (!assignmentRows[0]) {
    await connection.execute(
      'INSERT INTO user_role_assignments (user_id, role_id, partner_id) VALUES (?, ?, ?)',
      [userId, roleId, partnerId],
    );
  }

  console.log(`Admin ready: ${adminEmail}`);
  await connection.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
