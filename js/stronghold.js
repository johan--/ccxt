'use strict';

// ----------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');
const { InvalidNonce, AuthenticationError, AccountSuspended, InsufficientFunds, ExchangeError, ArgumentsRequired, NotSupported } = require ('./base/errors');

// ----------------------------------------------------------------------------

module.exports = class stronghold extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'stronghold',
            'name': 'Stronghold',
            'country': [ 'US' ],
            'rateLimit': 1000,
            'version': 'v1',
            'comment': 'This comment is optional',
            'urls': {
                'logo': 'https://user-images.githubusercontent.com/1294454/52160042-98c1f300-26be-11e9-90dd-da8473944c83.jpg',
                'api': {
                    'public': 'https://api.stronghold.co',
                    'private': 'https://api.stronghold.co',
                },
                'www': 'https://stronghold.co',
                'doc': [
                    'https://docs.stronghold.co',
                ],
            },
            'requiredCredentials': {
                'apiKey': true,
                'secret': true,
                'password': true,
            },
            'has': {
                'fetchMarkets': true,
                'fetchCurrencies': true,
                'fetchOrderBook': true,
                'fetchOpenOrders': true,
                'fetchTrades': true,
                'fetchMyTrades': true,
                'fetchDepositAddress': false,
                'createDepositAddress': true,
                'withdraw': true,
                'fetchTicker': false,
            },
            'api': {
                'public': {
                    'get': [
                        'utilities/time',
                        'utilites/uuid',
                        'venues',
                        'venues/{venueId}/assets',
                        'venues/{venueId}/markets',
                        'venues/{venueId}/markets/{marketId}/orderbook',
                        'venues/{venueId}/markets/{marketId}/trades',
                    ],
                    'post': [
                        'venues/{venueId}/assets',
                        'iam/credentials',
                        'identities',
                    ],
                    'patch': [
                        'identities',
                    ],
                    'put': [
                        'iam/credentials/{credentialId}',
                    ],
                    'delete': [
                        'iam/credentials/{credentialId}',
                    ],
                },
                'private': {
                    'get': [
                        'venues',
                        'venues/{venueId}/accounts/{accountId}',
                        'venues/{venueId}/custody/accounts/{accountId}/payment/{paymentId}',
                        'venues/{venueId}/accounts/{accountId}/orders',
                        'venues/{venueId}/accounts/{accountId}/trades',
                        'venues/{venueId}/accounts/{accountId}/transactions',
                    ],
                    'post': [
                        'venues/{venueId}/accounts',
                        'venues/{venueId}/accounts/{accountId}/orders',
                        'venues/{venueId}/accounts/{accountId}/deposit',
                        'venues/{venueId}/accounts/{accountId}/withdrawal',
                        'venues/{venueId}/custody/accounts/{accountId}/payment',
                        'venues/{venueId}/custody/accounts/{accountId}/payment/{paymentId}/stop',
                        'venues/{venueId}/custody/accounts/{accountId}/operations/{operationId}/signatures',
                        'venues/{venueId}/anchor/withdrawal',
                        'venues/{venueId}/testing/friendbot',
                    ],
                    'delete': [
                        'venues/{venueId}/accounts/{accountId}/orders/{orderId}',
                    ],
                },
            },
            'options': {
                'accountId': undefined,
                'venueId': 'trade-public',
                'venues': [ 'trade-public', 'sandbox-public' ],
                'paymentMethods': {
                    'ETH': 'ethereum',
                    'BTC': 'bitcoin',
                    'XLM': 'stellar',
                },
            },
            'exceptions': {
                'CREDENTIAL_MISSING': AuthenticationError,
                'CREDENTIAL_INVALID': AuthenticationError,
                'CREDENTIAL_REVOKED': AccountSuspended,
                'CREDENTIAL_NO_IDENTITY': AuthenticationError,
                'PASSPHRASE_INVALID': AuthenticationError,
                'SIGNATURE_INVALID': AuthenticationError,
                'TIME_INVALID': InvalidNonce,
                'BYPASS_INVALID': AuthenticationError,
                'INSUFFICIENT_FUNDS': InsufficientFunds,
            },
        });
    }

    async fetchTime (params = {}) {
        const response = await this.publicGetUtilitiesTime (params);
        //
        //     {
        //         "requestId": "6de8f506-ad9d-4d0d-94f3-ec4d55dfcdb9",
        //         "timestamp": 1536436649207281,
        //         "success": true,
        //         "statusCode": 200,
        //         "result": {
        //             "timestamp": "2018-09-08T19:57:29.207282Z"
        //         }
        //     }
        //
        return this.parse8601 (this.safeString (response['result'], 'timestamp'));
    }

    async fetchMarkets (params = {}) {
        const request = {
            'venueId': this.options['venueId'],
        };
        const response = await this.publicGetVenuesVenueIdMarkets (this.extend (request, params));
        const data = response['result'];
        //
        //     [
        //         {
        //             id: 'SHXUSD',
        //             baseAssetId: 'SHX/stronghold.co',
        //             counterAssetId: 'USD/stronghold.co',
        //             minimumOrderSize: '1.0000000',
        //             minimumOrderIncrement: '1.0000000',
        //             minimumPriceIncrement: '0.00010000',
        //             displayDecimalsPrice: 4,
        //             displayDecimalsAmount: 0
        //         },
        //         ...
        //     ]
        //
        const result = {};
        for (let i = 0; i < data.length; i++) {
            const entry = data[i];
            const marketId = entry['id'];
            const baseId = entry['baseAssetId'];
            const quoteId = entry['counterAssetId'];
            const baseAssetId = baseId.split ('/')[0];
            const quoteAssetId = quoteId.split ('/')[0];
            const base = this.commonCurrencyCode (baseAssetId);
            const quote = this.commonCurrencyCode (quoteAssetId);
            const symbol = base + '/' + quote;
            const limits = {
                'amount': {
                    'min': this.safeFloat (entry, 'minimumOrderSize'),
                    'max': undefined,
                },
                'price': {
                    'min': undefined,
                    'max': undefined,
                },
                'cost': {
                    'min': undefined,
                    'max': undefined,
                },
            };
            const precision = {
                'price': this.safeInteger (entry, 'displayDecimalsPrice'),
                'amount': this.safeInteger (entry, 'displayDecimalsAmount'),
            };
            result[symbol] = {
                'symbol': symbol,
                'id': marketId,
                'base': base,
                'quote': quote,
                'baseId': baseId,
                'quoteId': quoteId,
                'limits': limits,
                'precision': precision,
                'info': entry,
            };
        }
        return result;
    }

    async fetchCurrencies (params = {}) {
        const request = {
            'venueId': this.options['venueId'],
        };
        const response = await this.publicGetVenuesVenueIdAssets (this.extend (request, params));
        //
        //     [
        //         {
        //             id: 'XLM/native',
        //             alias: '',
        //             code: 'XLM',
        //             name: '',
        //             displayDecimalsFull: 7,
        //             displayDecimalsSignificant: 2,
        //         },
        //         ...
        //     ]
        //
        const data = response['result'];
        const result = {};
        for (let i = 0; i < data.length; i++) {
            const entry = data[i];
            const currencyId = this.safeString (entry, 'code');
            const code = this.commonCurrencyCode (currencyId);
            const precision = this.safeInteger (entry, 'displayDecimalsFull');
            result[code] = {
                'code': code,
                'id': currencyId,
                'precision': precision,
                'info': entry,
            };
        }
        return result;
    }

    async fetchOrderBook (symbol, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const marketId = this.marketId (symbol);
        const request = {
            'marketId': marketId,
            'venueId': this.options['venueId'],
        };
        const response = await this.publicGetVenuesVenueIdMarketsMarketIdOrderbook (this.extend (request, params));
        //
        //     {
        //         marketId: 'ETHBTC',
        //         bids: [
        //             [ '0.031500', '7.385000' ],
        //             ...,
        //         ],
        //         asks: [
        //             [ '0.031500', '7.385000' ],
        //             ...,
        //         ],
        //     }
        //
        const data = response['result'];
        const timestamp = this.parse8601 (this.safeString (response, 'timestamp'));
        return this.parseOrderBook (data, timestamp);
    }

    async fetchTrades (symbol, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'marketId': market['id'],
            'venueId': this.options['venueId'],
        };
        const response = await this.publicGetVenuesVenueIdMarketsMarketIdTrades (this.extend (request, params));
        //
        //     {
        //         "requestId": "4d343700-b53f-4975-afcc-732ae9d3c828",
        //         "timestamp": "2018-11-08T19:22:11.399543Z",
        //         "success": true,
        //         "statusCode": 200,
        //         "result": {
        //             "marketId": "",
        //             "trades": [
        //                 [ "0.9", "3.10", "sell", "2018-11-08T19:22:11.399547Z" ],
        //                 ...
        //             ],
        //         }
        //     }
        //
        return this.parseTrades (response['result']['trades'], market, since, limit);
    }

    async fetchTransactions (code = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const request = this.extend ({
            'venueId': this.options['venueId'],
            'accountId': this.options['accountId'],
        }, params);
        if (!request['accountId']) {
            throw new ArgumentsRequired (this.id + " fetchTransactions requires either the 'accountId' extra parameter or exchange.options['accountId'] = 'YOUR_ACCOUNT_ID'.");
        }
        const response = await this.privateGetVenuesVenueIdAccountsAccountIdTransactions (request);
        let currency = undefined;
        if (code !== undefined) {
            currency = this.currency (code);
        }
        return this.parseTransactions (response['result'], currency, since, limit);
    }

    parseTrade (trade, market = undefined) {
        //
        // fetchTrades (public)
        //
        //      [ '0.03177000', '0.0643501', 'sell', '2019-01-27T23:02:04Z' ]
        //
        // fetchMyTrades (private)
        //
        //     {
        //         id: '9cdb109c-d035-47e2-81f8-a0c802c9c5f9',
        //         orderId: 'a38d8bcb-9ff5-4c52-81a0-a40196a66462',
        //         marketId: 'XLMUSD',
        //         side: 'sell',
        //         size: '1.0000000',
        //         price: '0.10440600',
        //         settled: true,
        //         maker: false,
        //         executedAt: '2019-02-01T18:44:21Z'
        //     }
        //
        let id = undefined;
        let takerOrMaker = undefined;
        let price = undefined;
        let amount = undefined;
        let cost = undefined;
        let side = undefined;
        let timestamp = undefined;
        let orderId = undefined;
        if (this.isArray (trade)) {
            price = parseFloat (trade[0]);
            amount = parseFloat (trade[1]);
            side = parseFloat (trade[2]);
            timestamp = this.parse8601 (trade[3]);
        } else {
            id = this.safeString (trade, 'id');
            price = this.safeFloat (trade, 'price');
            amount = this.safeFloat (trade, 'size');
            side = this.safeString (trade, 'side');
            timestamp = this.parse8601 (this.safeString (trade, 'executedAt'));
            orderId = this.safeString (trade, 'orderId');
            let marketId = this.safeString (trade, 'marketId');
            market = this.safeValue (this.markets_by_id, marketId);
            takerOrMaker = trade['maker'] ? 'maker' : 'taker';
        }
        let symbol = undefined;
        if (market !== undefined) {
            symbol = market['symbol'];
        }
        return {
            'id': id,
            'info': trade,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'symbol': symbol,
            'type': undefined,
            'order': orderId,
            'side': side,
            'price': price,
            'amount': amount,
            'cost': cost,
            'takerOrMaker': takerOrMaker,
            'fee': {
                'cost': undefined,
                'currency': undefined,
                'rate': undefined,
            },
        };
    }

    async createOrder (symbol, type, side, amount, price = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = this.extend ({
            'venueId': this.options['venueId'],
            'accountId': this.options['accountId'],
            'marketID': market['id'],
            'type': type,
            'side': side,
            'size': this.amountToPrecision (symbol, amount),
            'price': this.priceToPrecision (symbol, price),
        }, params);
        if (!request['accountId']) {
            throw new ArgumentsRequired (this.id + " createOrder requires either the 'accountId' extra parameter or exchange.options['accountId'] = 'YOUR_ACCOUNT_ID'.");
        }
        const response = await this.privatePostVenuesVenueIdAccountsAccountIdOrders (request);
        // to be removed
        //     const datetime = this.safeString (response, 'timestamp');
        //     return {
        //         'id': undefined,
        //         'datetime': datetime,
        //         'timestamp': this.parse8601 (datetime),
        //         'info': response,
        //     };
        return this.parseOrder (response, market);
    }

    async cancelOrder (id, symbol = undefined, params = {}) {
        const request = this.extend ({
            'venueId': this.options['venueId'],
            'accountId': this.options['accountId'],
            'orderId': id,
        }, params);
        if (!request['accountId']) {
            throw new ArgumentsRequired (this.id + " cancelOrder requires either the 'accountId' extra parameter or exchange.options['accountId'] = 'YOUR_ACCOUNT_ID'.");
        }
        const response = await this.privateDeleteVenuesVenueIdAccountsAccountIdOrdersOrderId (request);
        // to be removed
        //     const datetime = this.safeString (response, 'timestamp');
        //     return {
        //         'id': id,
        //         'datetime': datetime,
        //         'timestamp': this.parse8601 (datetime),
        //         'info': response,
        //     };
        return this.parseOrder (response);
    }

    async fetchOpenOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const request = this.extend ({
            'venueId': this.options['venueId'],
            'accountId': this.options['accountId'],
        }, params);
        if (!request['accountId']) {
            throw new ArgumentsRequired (this.id + " cancelOrder requires either the 'accountId' extra parameter or exchange.options['accountId'] = 'YOUR_ACCOUNT_ID'.");
        }
        const response = await this.privateGetVenuesVenueIdAccountsAccountIdOrders (request);
        return this.parseOrders (response['result'], undefined, since, limit);
    }

    parseOrder (order, market = undefined) {
        let symbol = undefined;
        if (market !== undefined) {
            symbol = market['symbol'];
        }
        const id = this.safeString (order, 'id');
        const datetime = this.safeString (order, 'placedAt');
        const amount = this.safeFloat (order, 'size');
        const filled = this.safeFloat (order, 'sizeFilled');
        return {
            'id': id,
            'info': order,
            'symbol': symbol,
            'datetime': datetime,
            'timestamp': this.parse8601 (datetime),
            'side': this.safeString (order, 'side'),
            'amount': amount,
            'filled': filled,
            'remaining': amount - filled,
            'price': this.safeFloat (order, 'price'),
        };
    }

    nonce () {
        return this.seconds ();
    }

    setSandboxMode (enabled) {
        if (enabled) {
            this.options['venues']['backup'] = this.options['venues']['main'];
            this.options['venues']['main'] = this.options['venues']['sandbox'];
        } else {
            if ('backup' in this.options['venues']) {
                this.options['venues']['main'] = this.options['venues']['backup'];
            }
        }
    }

    async fetchBalance (params = {}) {
        const request = this.extend ({
            'venueId': this.options['venueId'],
            'accountId': this.options['accountId'],
        }, params);
        if (!request['accountId']) {
            throw new ArgumentsRequired (this.id + " fetchBalance requires either the 'accountId' extra parameter or exchange.options['accountId'] = 'YOUR_ACCOUNT_ID'.");
        }
        const response = await this.privateGetVenuesVenueIdAccountsAccountId (request);
        const balances = response['result']['balances'];
        let result = {};
        for (let i = 0; i < balances.length; i++) {
            const entry = balances[i];
            const asset = entry['assetId'].split ('/')[0];
            const code = this.commonCurrencyCode (asset);
            let account = {};
            account['total'] = this.safeFloat (entry, 'amount', 0.0);
            account['available'] = this.safeFloat (entry, 'availableForTrade', 0.0);
            account['free'] = account['total'] - account['available'];
            result[code] = account;
        }
        return this.parseBalance (result);
    }

    async fetchMyTrades (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const request = this.extend ({
            'venueId': this.options['venueId'],
            'accountId': this.options['accountId'],
        }, params);
        if (!request['accountId']) {
            throw new ArgumentsRequired (this.id + " fetchMyTrades requires either the 'accountId' extra parameter or exchange.options['accountId'] = 'YOUR_ACCOUNT_ID'.");
        }
        const response = await this.privateGetVenuesVenueIdAccountsAccountIdTrades (request);
        return this.parseTrades (response['result'], since, limit);
    }

    async createDepositAddress (code, params = {}) {
        await this.loadMarkets ();
        const paymentMethod = this.safeString (this.options['paymentMethods'], code);
        if (paymentMethod === undefined) {
            throw new NotSupported (this.id + ' createDepositAddress requires code to be BTC, ETH, or XLM');
        }
        const request = this.extend ({
            'venueId': this.options['venueId'],
            'accountId': this.options['accountId'],
            'assetId': this.currencyId (code),
            'paymentMethod': paymentMethod,
        }, params);
        if (!request['accountId']) {
            throw new ArgumentsRequired (this.id + " createDepositAddress requires either the 'accountId' extra parameter or exchange.options['accountId'] = 'YOUR_ACCOUNT_ID'.");
        }
        const response = await this.privatePostVenuesVenueIdAccountsAccountIdDeposit (request);
        //
        //     {
        //         assetId: 'BTC/stronghold.co',
        //         paymentMethod: 'bitcoin',
        //         paymentMethodInstructions: {
        //             deposit_address: 'mzMT9Cfw8JXVWK7rMonrpGfY9tt57ytHt4',
        //         },
        //         direction: 'deposit',
        //     }
        //
        const address = response['result']['paymentMethodInstructions']['deposit_address'];
        return {
            'currency': code,
            'address': this.checkAddress (address),
            'info': response,
        };
    }

    async withdraw (code, amount, address, tag = undefined, params = {}) {
        await this.loadMarkets ();
        const paymentMethod = this.safeString (this.options['paymentMethods'], code);
        if (paymentMethod === undefined) {
            throw new NotSupported (this.id + ' withdraw requires code to be BTC, ETH, or XLM');
        }
        const request = this.extend ({
            'venueId': this.options['venueId'],
            'accountId': this.options['accountId'],
            'assetId': this.currencyId (code),
            'amount': this.amountToPrecision (amount, code),
            'paymentMethod': paymentMethod,
            'paymentMethodDetails': {
                'withdrawal_address': address,
            },
        }, params);
        if (!request['accountId']) {
            throw new ArgumentsRequired (this.id + " withdraw requires either the 'accountId' extra parameter or exchange.options['accountId'] = 'YOUR_ACCOUNT_ID'.");
        }
        const response = await this.privatePostVenuesVenueIdAccountsAccountIdWithdrawal (request);
        //
        //     {
        //         "id": "5be48892-1b6e-4431-a3cf-34b38811e82c",
        //         "assetId": "BTC/stronghold.co",
        //         "amount": "10",
        //         "feeAmount": "0.01",
        //         "paymentMethod": "bitcoin",
        //         "paymentMethodDetails": {
        //             "withdrawal_address": "1vHysJeXYV6nqhroBaGi52QWFarbJ1dmQ"
        //         },
        //         "direction": "withdrawal",
        //         "status": "pending"
        //     }
        //
        //     return {
        //         'id': response['result']['id'],
        //         'info': response,
        //     };
        return this.parseTransaction (response);
    }

    async fetchAccounts (params) {
        //     return await this.privatePostVenuesVenueIdAccounts (params);
        throw new NotSupported (this.id + ' fetchAccounts is not implemented on the exchange side.');
    }

    handleErrors (code, reason, url, method, headers, body, response) {
        if (!response) {
            return; // fallback to base error handler by default
        }
        //
        //     {
        //         requestId: '3e7d17ab-b316-4721-b5aa-f7e6497eeab9',
        //         timestamp: '2019-01-31T21:59:06.696855Z',
        //         success: true,
        //         statusCode: 200,
        //         result: []
        //     }
        //
        let errorCode = this.safeString (response, 'errorCode');
        if (errorCode in this.exceptions) {
            let Exception = this.exceptions[errorCode];
            throw new Exception (this.id + ' ' + body);
        }
        const success = this.safeValue (response, 'success');
        if (!success) {
            throw new ExchangeError (this.id + ' ' + body);
        }
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        const request = '/' + this.version + '/' + this.implodeParams (path, params);
        let query = this.omit (params, this.extractParams (path));
        let url = this.urls['api'][api] + request;
        if (method === 'GET') {
            if (Object.keys (query).length) {
                url += '?' + this.urlencode (query);
            } else {
                body = this.json (query);
            }
        }
        if (api === 'private') {
            this.checkRequiredCredentials ();
            const timestamp = this.nonce ().toString ();
            let payload = timestamp + method + request;
            if (body !== undefined) {
                payload += body;
            }
            const secret = this.base64ToBinary (this.secret);
            headers = {
                'SH-CRED-ID': this.apiKey,
                'SH-CRED-SIG': this.hmac (this.encode (payload), secret, 'sha256', 'base64'),
                'SH-CRED-TIME': timestamp,
                'SH-CRED-PASS': this.password,
                'Content-Type': 'application/json',
            };
        }
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }
};
