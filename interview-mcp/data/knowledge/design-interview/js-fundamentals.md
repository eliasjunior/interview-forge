# JavaScript Fundamentals: DOM, Callbacks, Promises, XHR, Event Loop & Web APIs

## Summary
This topic covers core JavaScript knowledge expected in frontend and full-stack interviews, with emphasis on how JavaScript behaves in the browser runtime rather than just language syntax. A strong candidate should understand how the DOM is represented and manipulated, how callbacks and promises model asynchronous work, how legacy browser APIs like `XMLHttpRequest` compare to modern patterns, and how the event loop coordinates synchronous code, microtasks, macrotasks, and browser-provided Web APIs.

The goal is not memorizing isolated definitions, but reasoning about execution order, async behavior, browser interactions, error handling, and maintainable code design. Strong answers should connect language concepts to real browser behavior and common interview scenarios.

---

## Questions

1. What is the DOM, and how is it different from the HTML source of a page?
2. How do `querySelector`, `getElementById`, and `getElementsByClassName` differ, and when would you use each?
3. What is a callback in JavaScript, and why are callbacks commonly used with browser APIs?
4. What problem do Promises solve compared to nested callbacks?
5. Walk me through the JavaScript event loop and explain the difference between the call stack, task queue, and microtask queue.
6. What are Web APIs in the browser, and how do they interact with JavaScript execution?
7. Compare `setTimeout(..., 0)`, `Promise.resolve().then(...)`, and synchronous code execution order.
8. What is event delegation in the DOM, and why is it useful?
9. How does `XMLHttpRequest` work, and what are its main drawbacks compared to modern async patterns?
10. How would you wrap a callback-based or XHR-based API in a Promise?
11. How do errors propagate differently in callbacks, Promises, and `async`/`await`?
12. What browser and rendering pitfalls would you consider when updating the DOM frequently in response to user input or network results?
13. If a page becomes unresponsive because a long-running JavaScript task blocks the main thread, how would you diagnose it and what design changes would you make?
14. How would you reason about race conditions in the browser when multiple async requests update the same UI state?
15. How would you design a resilient data-fetching flow in the browser that handles loading, cancellation, retries, and stale responses cleanly?
16. Explain a realistic execution-order example that combines DOM events, `setTimeout`, Promises, and an XHR or fetch-style async completion.

---

## Difficulty

- Question 1: foundation
- Question 2: foundation
- Question 3: foundation
- Question 4: foundation
- Question 5: foundation
- Question 6: intermediate
- Question 7: intermediate
- Question 8: intermediate
- Question 9: intermediate
- Question 10: intermediate
- Question 11: intermediate
- Question 12: intermediate
- Question 13: advanced
- Question 14: advanced
- Question 15: advanced
- Question 16: advanced

---

## Evaluation Criteria

- Question 1: Must explain that the DOM is the browser's object representation of the document, exposed as a tree of nodes that JavaScript can read and mutate. Must distinguish it from raw HTML source, which is just text until parsed. Weak answer: treats DOM and HTML as identical without mentioning the parsed tree model.
- Question 2: Must explain that `getElementById` returns a single element by ID, `querySelector` returns the first match for any CSS selector, and `getElementsByClassName` returns a live collection. Strong answer mentions that `querySelectorAll` returns a static `NodeList`. Weak answer: only says they "find elements" without discussing selector flexibility or collection behavior.
- Question 3: Must define a callback as a function passed to another function to be executed later, often after an event or async operation completes. Must tie this to browser APIs such as event listeners, timers, or XHR handlers. Weak answer: gives only a generic function-as-argument definition without connecting it to async flow.
- Question 4: Must explain that Promises improve composition, readability, and error propagation compared to deeply nested callbacks ("callback hell"). Strong answer mentions states (`pending`, `fulfilled`, `rejected`) and chaining with `then`, `catch`, and `finally`. Weak answer: says Promises are "modern callbacks" without naming the real problems they solve.
- Question 5: Must explain: synchronous code runs on the call stack; completed async callbacks are queued; the event loop moves work from queues onto the stack when it is empty. Must distinguish task/macrotask queue from microtask queue, and state that microtasks run before the next macrotask. Weak answer: vague "JavaScript is single-threaded" without explaining scheduling.
- Question 6: Must describe Web APIs as browser-provided capabilities outside the JavaScript language itself, such as DOM events, timers, XHR/fetch, storage, and `MutationObserver`. Must explain that browser APIs handle async work and later schedule callbacks or promise resolution back into the event loop. Weak answer: treats Web APIs as part of ECMAScript or cannot explain the boundary between JS engine and browser runtime.
- Question 7: Must explain execution order: synchronous code first, then microtasks such as `Promise.then`, then macrotasks such as `setTimeout`. Must state that `setTimeout(..., 0)` does not run immediately; it schedules the callback for a later task queue turn. Weak answer: assumes timeout 0 executes before promises or immediately after the current line.
- Question 8: Must explain event delegation as attaching one listener to a common ancestor and handling child interactions through event bubbling and `event.target`. Must mention benefits: fewer listeners, support for dynamic content, simpler memory/performance profile. Weak answer: knows bubbling exists but cannot explain why delegation is useful in real DOM code.
- Question 9: Must explain that `XMLHttpRequest` is an older browser API for HTTP requests using event/callback-based state changes such as `readystatechange` or `load`. Must mention drawbacks: verbose API, awkward error handling, callback nesting, and less ergonomic composition than Promises. Bonus: notes that XHR still has features like upload progress events. Weak answer: only says "XHR is old, fetch is new".
- Question 10: Must describe creating a new `Promise` and resolving/rejecting it based on callback or XHR completion events. Must mention mapping both success and failure paths correctly and avoiding double resolve/reject. Strong answer discusses cleanup such as removing listeners or handling aborts. Weak answer: wraps success path only and ignores errors.
- Question 11: Must explain differences clearly: callback style often uses explicit error-first conventions or separate success/error handlers; Promises propagate failures through rejection and `catch`; `async`/`await` surfaces async failures through `try/catch` syntax over Promises. Must mention unhandled promise rejections as an operational concern. Weak answer: treats all three models as having the same error semantics.
- Question 12: Must discuss performance and UX implications of frequent DOM updates: layout thrashing, excessive reflows/repaints, too many event listeners, and repeated synchronous state mutations. Strong answer mentions batching DOM writes, minimizing layout reads between writes, and using document fragments or framework batching. Weak answer: only says "optimize the DOM" without concrete browser behavior.
- Question 13: Must identify that long-running JavaScript blocks the single main thread, preventing input handling, painting, and queued callbacks from progressing. Must propose diagnosis with browser DevTools performance profiling and design changes such as chunking work, yielding back to the event loop, moving heavy work to Web Workers, or reducing synchronous processing. Weak answer: suggests adding more promises or timeouts without addressing main-thread blocking.
- Question 14: Must explain race conditions such as an older request finishing after a newer one and overwriting the UI with stale data. Must propose mitigation strategies: request IDs/versioning, cancellation/abort, last-write-wins rules, or state guards before rendering. Weak answer: only mentions "async is unpredictable" without giving a concrete control strategy.
- Question 15: Must describe a maintainable async UI flow with explicit loading/error/success states, request cancellation via `AbortController` or equivalent, bounded retry only for transient failures, and stale-response protection. Bonus: discusses deduplication and centralizing fetch logic. Weak answer: retries every failure blindly or mixes UI rendering, retry logic, and transport logic into one large function.
- Question 16: Must correctly reason through a mixed execution-order example using browser events, synchronous handlers, promise microtasks, timer macrotasks, and network completion callbacks. Strong answer states the expected ordering and why, not just the final sequence. Weak answer: guesses an order without referencing microtasks, task queues, or browser scheduling behavior.

## Concepts

- core concepts: javascript-runtime, dom, callback, promise, async-await, event-loop, call-stack, microtask, macrotask, web-api
- practical usage: queryselector, event-listener, event-delegation, xmlhttprequest, fetch, settimeout, abortcontroller, promise-chaining, try-catch, devtools-performance
- tradeoffs: callbacks-vs-promises, xhr-vs-modern-apis, sync-vs-async, readability-vs-control, immediate-dom-updates-vs-batching, retry-vs-fail-fast
- best practices: keep-main-thread-light, centralize-async-error-handling, protect-against-stale-responses, batch-dom-mutations, prefer-clear-async-composition, separate-transport-from-ui-state
