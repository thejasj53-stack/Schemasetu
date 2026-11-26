import {describe,expect,it} from 'vitest';
import {vectorLiteral,scholarshipEmbeddingText} from '../src/embeddingService.js';
describe('semantic index input',()=>{
 it('serializes only a validated 768-dimensional vector',()=>{const vector=new Array(768).fill(0.25);expect(vectorLiteral(vector).startsWith('[')).toBe(true);expect(vectorLiteral(vector).endsWith(']')).toBe(true);expect(()=>vectorLiteral([1,2])).toThrow('invalid_embedding')});
 it('builds embedding text from scholarship fields only',()=>{const text=scholarshipEmbeddingText({name:'Merit award',state_name:'Goa',target_categories:['SC'],other_conditions:'Verified condition'});expect(text).toContain('Merit award');expect(text).toContain('Goa');expect(text).not.toContain('undefined')});
});
