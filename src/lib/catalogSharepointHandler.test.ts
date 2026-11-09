// @ts-ignore Bun supplies the test runner
import { expect, test } from 'bun:test';

for (const path of ['/api/catalogo-planilha-aplicar', '/api/public/catalogo-planilha-aplicar']) {
  test(`${path} rejeita token inválido sem gravar`, async () => {
    const response = await fetch(`http://localhost:8080${path}`, {
      method: 'POST', headers: { Authorization: 'Bearer invalid-test-token', 'Content-Type': 'application/json' }, body: '{}',
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ erro: 'Token inválido' });
  });
  test(`${path} rejeita chamada sem token`, async () => {
    const response = await fetch(`http://localhost:8080${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect(response.status).toBe(401);
  });
}