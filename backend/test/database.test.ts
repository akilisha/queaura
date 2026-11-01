import { describe, expect, it } from 'vitest';
import { connection } from '../src/db/database.ts';

describe('database connection', () => {
  it('uses the URL as is without a certificate', () => {
    expect(connection('postgres://u:p@h:5432/db?sslmode=require')).toEqual({ connectionString: 'postgres://u:p@h:5432/db?sslmode=require' });
  });
  it("checks the server against the certificate, so the URL's sslmode can't weaken it", () => {
    expect(connection('postgres://u:p@h:25060/db?sslmode=require', 'PEM')).toEqual({
      connectionString: 'postgres://u:p@h:25060/db',
      ssl: { ca: 'PEM', rejectUnauthorized: true },
    });
  });
});
