import {describe,expect,it} from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('API safety and search contract',()=>{
 it('reports database configuration without leaking secrets',async()=>{
  const response=await request(app).get('/api/health');
  expect(response.status).toBe(200);expect(response.body).toHaveProperty('ok',true);expect(response.body).not.toHaveProperty('serviceRoleKey');
 });
 it('rejects unsupported page sizes before querying storage',async()=>{
  const response=await request(app).get('/api/scholarships?pageSize=7');
  expect(response.status).toBe(400);
 });
 it('serves source-linked local scholarships when shared storage is not configured',async()=>{
  if(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY)return;
  const response=await request(app).get('/api/scholarships');
  expect(response.status).toBe(200);expect(response.body.data).toHaveLength(8);expect(response.body.source).toBe('local sample catalog');expect(response.body.data.every((s:any)=>s.official_url?.startsWith('https://'))).toBe(true);
 });
});

describe('assistant request validation',()=>{
 it('rejects very short questions',async()=>{
  const response=await request(app).post('/api/assistant').send({question:'?' });
  expect(response.status).toBe(400);
 });
 it('returns a grounded local catalog answer when NVIDIA is not configured',async()=>{
  if((process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY)||process.env.NVIDIA_API_KEY)return;
  const response=await request(app).post('/api/assistant').send({question:'Which scholarships are open for students in Delhi?'});
  expect(response.status).toBe(200);expect(response.body.mode).toBe('local');expect(response.body.answer).toContain('local catalog');expect(response.body.sources.length).toBeGreaterThan(0);
 });
});

describe('admin route authorization',()=>{
 it('does not expose the admin coverage dashboard without an administrator token',async()=>{
  const response=await request(app).get('/api/admin/overview');
  expect(response.status).toBe(403);
 });
});
