import {describe,expect,it} from 'vitest';
import {maskSensitiveText,summarizeDocument} from '../src/documentAnalysis.js';
describe('document analysis privacy',()=>{
 it('masks Aadhaar and PAN patterns',()=>{expect(maskSensitiveText('1234 5678 9012 ABCDE1234F')).toContain('XXXX-XXXX-9012');expect(maskSensitiveText('ABCDE1234F')).toBe('ABXXXXXX4F')});
 it('classifies a marksheet but does not claim identity verification',()=>{const result=summarizeDocument('STATEMENT OF MARKS Student marks card passed examination',88);expect(result.documentType).toBe('marksheet');expect(result.readable).toBe(true);expect(result.warnings.some(x=>x.includes('not government identity verification'))).toBe(true)});
 it('keeps low readability explicit',()=>{const result=summarizeDocument('UIDAI Aadhaar number 123456789012',20);expect(result.documentType).toBe('aadhaar');expect(result.readable).toBe(false);expect(result.maskedFields.aadhaar).toBe('XXXX-XXXX-9012')});
});
