import { describe, expect, it } from 'vitest';
import { formatNumber, ordinal } from './format';
import { display, parse, press, type Key } from './keypad';
import { answerFraction, remaining, seconds } from './time';

const type = (keys: Key[]) => keys.reduce(press, '');

describe('time', () => {
  it('counts down from when the state arrived, and freezes while paused', () => {
    expect(remaining(10_000, 1_000, 4_000, false)).toBe(7_000);
    expect(remaining(10_000, 1_000, 4_000, true)).toBe(10_000);
    expect(remaining(1_000, 0, 5_000, false)).toBe(0);
  });
  it('keeps the bar full during reading, then drains over the answer window', () => {
    expect(answerFraction(25_000, 20_000)).toBe(1);
    expect(answerFraction(10_000, 20_000)).toBe(0.5);
    expect(answerFraction(0, 20_000)).toBe(0);
  });
  it('rounds seconds up', () => {
    expect(seconds(1)).toBe(1);
    expect(seconds(1000)).toBe(1);
    expect(seconds(1001)).toBe(2);
    expect(seconds(0)).toBe(0);
  });
});

describe('keypad', () => {
  it('builds numbers without leading zeros', () => {
    expect(type(['0', '7'])).toBe('7');
    expect(type(['1', '9', '6', '9'])).toBe('1969');
  });
  it('handles decimals, sign and backspace', () => {
    expect(type(['.', '5'])).toBe('0.5');
    expect(type(['3', '.', '.', '1'])).toBe('3.1');
    expect(type(['4', 'sign'])).toBe('-4');
    expect(type(['sign', '4', 'sign'])).toBe('4');
    expect(type(['sign', 'back'])).toBe('');
    expect(type(['1', '2', 'back'])).toBe('1');
  });
  it('displays entries grouped as typed', () => {
    expect(display('1234567')).toBe('1,234,567');
    expect(display('-1234.5')).toBe('−1,234.5');
    expect(display('12.')).toBe('12.');
    expect(display('-')).toBe('−');
  });
  it('parses only complete numbers', () => {
    expect(parse('42')).toBe(42);
    expect(parse('-0.5')).toBe(-0.5);
    expect(parse('3.')).toBeNull();
    expect(parse('-')).toBeNull();
    expect(parse('')).toBeNull();
  });
});

describe('format', () => {
  it('groups thousands and trims decimals', () => {
    expect(formatNumber(8849)).toBe('8,849');
    expect(formatNumber(299792.458)).toBe('299,792.458');
    expect(formatNumber(-40)).toBe('−40');
    expect(formatNumber(2.5)).toBe('2.5');
  });
  it('writes ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual(
      ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st'],
    );
  });
});
