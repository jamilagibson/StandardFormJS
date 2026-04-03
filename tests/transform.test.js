import { transformStandard } from '../js/transform.js';

describe('transformStandard', () => {
  it('transforms a standard 4-segment code', () => {
    expect(transformStandard('2.RF.3.b')).toEqual({ result: 'RF.2.3.b', error: null });
  });

  it('ignores leading segments beyond 4', () => {
    expect(transformStandard('BBEE.FTH-Literacy.2.RF.3.b')).toEqual({ result: 'RF.2.3.b', error: null });
  });

  it('uppercases a lowercase domain code', () => {
    expect(transformStandard('2.rf.3.b')).toEqual({ result: 'RF.2.3.b', error: null });
  });

  it('normalizes mixed-case domain (Rf)', () => {
    expect(transformStandard('2.Rf.3.b')).toEqual({ result: 'RF.2.3.b', error: null });
  });

  it('normalizes mixed-case domain and letter (rF, B)', () => {
    expect(transformStandard('2.rF.3.B')).toEqual({ result: 'RF.2.3.b', error: null });
  });

  it('returns null result and null error for empty string', () => {
    expect(transformStandard('')).toEqual({ result: null, error: null });
  });

  it('returns null result and truthy error for null', () => {
    const { result, error } = transformStandard(null);
    expect(result).toBeNull();
    expect(error).toBeTruthy();
  });

  it('returns null result and truthy error for undefined', () => {
    const { result, error } = transformStandard(undefined);
    expect(result).toBeNull();
    expect(error).toBeTruthy();
  });

  it('returns error when fewer than 4 segments', () => {
    const { result, error } = transformStandard('RF.3.b');
    expect(result).toBeNull();
    expect(error).toBeTruthy();
  });

  it('returns error when final segment is not a single letter', () => {
    const { result, error } = transformStandard('2.RF.3.12');
    expect(result).toBeNull();
    expect(error).toBeTruthy();
  });

  it('returns error when standard number is not digits', () => {
    const { result, error } = transformStandard('2.RF.b.b');
    expect(result).toBeNull();
    expect(error).toBeTruthy();
  });

  it('returns error when domain code is not alphabetic', () => {
    const { result, error } = transformStandard('2.3.3.b');
    expect(result).toBeNull();
    expect(error).toBeTruthy();
  });

  it('returns error when grade is not digits', () => {
    const { result, error } = transformStandard('b.RF.3.b');
    expect(result).toBeNull();
    expect(error).toBeTruthy();
  });

  it('trims surrounding whitespace', () => {
    expect(transformStandard(' 2.RF.3.b ')).toEqual({ result: 'RF.2.3.b', error: null });
  });
});
