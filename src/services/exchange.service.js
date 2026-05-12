'use strict';

const { errors } = require('../lib/errors');
const { env } = require('../config/env');


const MOCK_RATES_KZT = {
  KZT: 1,
  USD: 470.5,
  EUR: 510.25,
  RUB: 5.2,
  GBP: 595.0,
  CNY: 65.3,
  TRY: 14.7,
};

/**
 * Returns how many KZT one unit of `currency` is worth at this moment.
 * @param {string} currency  
 * @returns {Promise<number>}
 */
async function getRateToKzt(currency) {
  if (env.EXCHANGE_PROVIDER === 'mock') {
    const rate = MOCK_RATES_KZT[currency];
    if (!rate) throw errors.UnsupportedCurrency(currency);
    return rate;
  }
  throw errors.UnsupportedCurrency(currency);
}


function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

module.exports = { getRateToKzt, round2, MOCK_RATES_KZT };