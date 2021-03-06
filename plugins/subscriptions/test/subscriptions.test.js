const { init } = require('../../../src')
const subscriptionsPlugin = require('../src').default

const common = {
	state: 0,
	reducers: {
		addOne: state => state + 1,
	},
}

xdescribe('subscriptions:', () => {
	test('should create a working subscription', () => {
		const first = {
			...common,
			subscriptions: {
				'second/addOne'() {
					this.addOne()
				},
			},
		}
		const second = common
		const store = init({
			models: { first, second },
			plugins: [subscriptionsPlugin()],
		})

		store.dispatch.second.addOne()

		expect(store.getState()).toEqual({
			second: 1,
			first: 1,
		})
	})

	test('should allow for two subscriptions with same name in different models', () => {
		const a1 = {
			...common,
			subscriptions: {
				'b1/addOne'() {
					this.addOne()
				},
			},
		}
		const b1 = common
		const c1 = {
			...common,
			subscriptions: {
				'b1/addOne'() {
					this.addOne()
				},
			},
		}
		const store = init({
			models: { a1, b1, c1 },
			plugins: [subscriptionsPlugin()],
		})

		store.dispatch.b1.addOne()

		expect(store.getState()).toEqual({
			a1: 1,
			b1: 1,
			c1: 1,
		})
	})

	test('should allow for three subscriptions with same name in different models', () => {
		const a = {
			...common,
			subscriptions: {
				'b/addOne'() {
					this.addOne()
				},
			},
		}
		const b = common
		const c = {
			...common,
			subscriptions: {
				'b/addOne'() {
					this.addOne()
				},
			},
		}
		const d = {
			...common,
			subscriptions: {
				'b/addOne'() {
					this.addOne()
				},
			},
		}
		// no subscriptions, superfluous model
		// just an additional check to see that
		// other models are not effected
		const e = common
		const store = init({
			models: {
				a,
				b,
				c,
				d,
				e,
			},
			plugins: [subscriptionsPlugin()],
		})

		store.dispatch.b.addOne()

		expect(store.getState()).toEqual({
			a: 1,
			b: 1,
			c: 1,
			d: 1,
			e: 0,
		})
	})

	test('should throw if a subscription matcher is invalid', () => {
		const store = init({
			plugins: [subscriptionsPlugin()],
		})

		expect(() =>
			store.model({
				name: 'first',
				...common,
				subscriptions: {
					'Not/A/Valid/Matcher': () => store.dispatch.first.addOne(),
				},
			})
		).toThrow()
	})

	test('should enforce subscriptions are functions', () => {
		const store = init({
			plugins: [subscriptionsPlugin()],
		})

		expect(() =>
			store.model({
				name: 'first',
				...common,
				subscriptions: {
					'valid/matcher': 42,
				},
			})
		).toThrow()
	})

	describe('pattern matching', () => {
		test('should create working pattern matching subscription (second/*)', () => {
			const first = {
				...common,
				subscriptions: {
					'second/*'() {
						this.addOne()
					},
				},
			}
			const second = common
			const store = init({
				models: { first, second },
				plugins: [subscriptionsPlugin()],
			})

			store.dispatch.second.addOne()

			expect(store.getState()).toEqual({
				second: 1,
				first: 1,
			})
		})

		test('should create working pattern matching subsription (*/addOne)', () => {
			const first = {
				...common,
				subscriptions: {
					'*/add'() {
						this.addOne()
					},
				},
			}
			const second = {
				state: 0,
				reducers: {
					add: (state, payload) => state + payload,
				},
			}
			const store = init({
				models: { first, second },
				plugins: [subscriptionsPlugin()],
			})

			store.dispatch.second.add(2)

			expect(store.getState()).toEqual({
				second: 2,
				first: 1,
			})
		})

		test('should create working pattern matching subscription (second/add*)', () => {
			const first = {
				...common,
				subscriptions: {
					'second/add*'() {
						this.addOne()
					},
				},
			}
			const second = common
			const store = init({
				models: { first, second },
				plugins: [subscriptionsPlugin()],
			})

			store.dispatch.second.addOne()

			expect(store.getState()).toEqual({
				second: 1,
				first: 1,
			})
		})

		test('should throw an error if a user creates a subscription that matches a reducer in the model', () => {
			const store = init({
				plugins: [subscriptionsPlugin()],
			})

			const createModel = () =>
				store.model({
					name: 'first',
					state: 0,
					reducers: {
						addOne: state => state + 1,
					},
					subscriptions: {
						'first/addOne'() {
							console.log('anything')
						},
					},
				})

			expect(createModel).toThrow()
		})

		test('should throw an error if a user creates a subscription that matches an effect in the model', () => {
			const store = init({
				plugins: [subscriptionsPlugin()],
			})

			const createModel = () =>
				store.model({
					name: 'first',
					state: 0,
					effects: {
						sayHi: () => console.log('hi'),
					},
					subscriptions: {
						'first/sayHi'() {
							console.log('anything')
						},
					},
				})

			expect(createModel).toThrow()
		})

		test('should throw an error if a user creates a subscription that pattern matches a reducer in the model', () => {
			const store = init({
				plugins: [subscriptionsPlugin()],
			})

			const createModel = () =>
				store.model({
					name: 'first',
					state: 0,
					reducers: {
						addOne: state => state + 1,
					},
					subscriptions: {
						'*/addOne'() {
							console.log('anything')
						},
					},
				})

			expect(createModel).toThrow()
		})
	})

	test('should have access to state from second param', () => {
		const first = {
			state: 3,
			reducers: {
				addBy: (state, payload) => state + payload,
			},
			subscriptions: {
				'second/addOne'(action, state) {
					this.addBy(state.first)
				},
			},
		}
		const second = {
			...common,
		}
		const store = init({
			models: { first, second },
			plugins: [subscriptionsPlugin()],
		})

		store.dispatch.second.addOne()

		expect(store.getState()).toEqual({
			second: 1,
			first: 6,
		})
	})

	describe('unsubscribe:', () => {
		test('a matched action', () => {
			const { createUnsubscribe } = require('../src/unsubscribe')
			const first = {
				...common,
				subscriptions: {
					'second/addOne'() {
						this.addOne()
					},
				},
			}
			const second = {
				...common,
			}
			const store = init({
				models: { first, second },
				plugins: [subscriptionsPlugin()],
			})
			const unsubscribe = createUnsubscribe('first', 'second/addOne')
			unsubscribe()
			store.dispatch.second.addOne()

			expect(store.getState()).toEqual({
				second: 1,
				first: 0,
			})
		})
		test('a pattern matched action', () => {
			const { createUnsubscribe } = require('../src/unsubscribe')
			const first = {
				...common,
				subscriptions: {
					'second/*'() {
						this.addOne()
					},
				},
			}
			const second = {
				...common,
			}
			const store = init({
				models: { first, second },
				plugins: [subscriptionsPlugin()],
			})

			const unsubscribe = createUnsubscribe('first', 'second/*')
			unsubscribe()
			store.dispatch.second.addOne()

			expect(store.getState()).toEqual({
				second: 1,
				first: 0,
			})
		})
		test('a pattern matched action when more than one', () => {
			const { createUnsubscribe } = require('../src/unsubscribe')
			const first = {
				...common,
				subscriptions: {
					'second/*'() {
						this.addOne()
					},
				},
			}
			const second = {
				...common,
			}
			const third = {
				...common,
				subscriptions: {
					'second/*'() {
						this.addOne()
					},
				},
			}
			const store = init({
				models: { first, second, third },
				plugins: [subscriptionsPlugin()],
			})
			const unsubscribe = createUnsubscribe('first', 'second/*')
			unsubscribe()
			store.dispatch.second.addOne()

			expect(store.getState()).toEqual({
				first: 0,
				second: 1,
				third: 1,
			})
		})
		test('should throw if invalid action', () => {
			const { createUnsubscribe } = require('../src/unsubscribe')
			const first = {
				...common,
				subscriptions: {
					'second/addOne'() {
						this.addOne()
					},
				},
			}
			init({
				models: { first },
				plugins: [subscriptionsPlugin()],
			})

			const unsubscribe = createUnsubscribe('first', 'an/invalid/action')

			expect(unsubscribe).toThrow()
		})
		test('should do nothing if no action', () => {
			const { createUnsubscribe } = require('../src/unsubscribe')
			const first = {
				...common,
				subscriptions: {
					'second/addOne'() {
						this.addOne()
					},
				},
			}
			const second = common
			const store = init({
				models: { first, second },
				plugins: [subscriptionsPlugin()],
			})

			const unsubscribe = createUnsubscribe('first', 'not/existing')
			unsubscribe()
			store.dispatch.second.addOne()

			expect(store.getState()).toEqual({
				second: 1,
				first: 1,
			})
		})

		test('should allow unsubscribe within a model', () => {
			const first = {
				...common,
				subscriptions: {
					'second/addOne'(action, exposed, unsubscribe) {
						this.addOne()
						unsubscribe()
					},
				},
			}
			const second = common
			const store = init({
				models: { first, second },
				plugins: [subscriptionsPlugin()],
			})

			store.dispatch.second.addOne()
			store.dispatch.second.addOne()
			store.dispatch.second.addOne()

			expect(store.getState()).toEqual({
				second: 3,
				first: 1,
			})
		})

		test('should allow unsubscribe within a model with a pattern match', () => {
			const first = {
				...common,
				subscriptions: {
					'other/*'(action, exposed, unsubscribe) {
						this.addOne()
						unsubscribe()
					},
				},
			}
			const other = common
			const store = init({
				models: { first, other },
				plugins: [subscriptionsPlugin()],
			})

			store.dispatch.other.addOne()
			store.dispatch.other.addOne()
			store.dispatch.other.addOne()

			expect(store.getState()).toEqual({
				other: 3,
				first: 1,
			})
		})
	})
})
