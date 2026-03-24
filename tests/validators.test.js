import { readFileSync } from 'fs';
import { resolve } from 'path';

const validatorsCode = readFileSync(resolve('src/utils/validators.js'), 'utf-8');
const patchedCode = validatorsCode.replace(/^const GPMValidators\s*=/m, 'globalThis.GPMValidators =');
new Function(patchedCode)();
const GPMValidators = globalThis.GPMValidators;

describe('GPMValidators - Tags', () => {
  describe('validateTag()', () => {
    it('should validate a valid tag', () => {
      const tag = { id: 't1', name: 'Important', color: '#ef4444' };
      const result = GPMValidators.validateTag(tag);
      expect(result).toMatchObject({
        id: 't1',
        name: 'Important',
        color: '#ef4444',
      });
    });

    it('should sanitize tag name and remove HTML', () => {
      const tag = { id: 't1', name: '<script>Bad</script>Important', color: '#ef4444' };
      const result = GPMValidators.validateTag(tag);
      expect(result.name).toBe('scriptBad/scriptImpo');
    });

    it('should return null for missing id', () => {
      const tag = { name: 'Test', color: '#ef4444' };
      const result = GPMValidators.validateTag(tag);
      expect(result).toBeNull();
    });

    it('should return null for empty name', () => {
      const tag = { id: 't1', name: '', color: '#ef4444' };
      const result = GPMValidators.validateTag(tag);
      expect(result).toBeNull();
    });

    it('should truncate name to 20 characters', () => {
      const tag = { id: 't1', name: 'This is a very long tag name', color: '#ef4444' };
      const result = GPMValidators.validateTag(tag);
      expect(result.name.length).toBeLessThanOrEqual(20);
    });

    it('should use default color for invalid hex', () => {
      const tag = { id: 't1', name: 'Test', color: 'invalid' };
      const result = GPMValidators.validateTag(tag);
      expect(result.color).toBe('#3b82f6');
    });
  });

  describe('sanitizeTagColor()', () => {
    it('should accept valid hex colors', () => {
      expect(GPMValidators.sanitizeTagColor('#ef4444')).toBe('#ef4444');
      expect(GPMValidators.sanitizeTagColor('#22c55e')).toBe('#22c55e');
    });

    it('should return default for invalid colors', () => {
      expect(GPMValidators.sanitizeTagColor('red')).toBe('#3b82f6');
      expect(GPMValidators.sanitizeTagColor('')).toBe('#3b82f6');
    });
  });
});
