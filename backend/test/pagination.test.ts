import {describe,expect,it} from 'vitest';
import {paginationRange} from '../src/pagination.js';
describe('server pagination ranges',()=>{
 it('calculates consecutive non-overlapping pages for all supported sizes',()=>{
  for(const size of [20,50,100]){const first=paginationRange(1,size),second=paginationRange(2,size);expect(first).toEqual({from:0,to:size-1});expect(second).toEqual({from:size,to:2*size-1});expect(second.from).toBe(first.to+1)}
 });
 it('rejects invalid pages and page sizes',()=>{expect(()=>paginationRange(0,20)).toThrow();expect(()=>paginationRange(1,10)).toThrow()});
});
