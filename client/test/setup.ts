import 'fake-indexeddb/auto';

/**
 * Node has no object URLs. The local engine only needs them to hand a Blob to
 * an <audio> element, so a string generator is enough.
 */
if (typeof (URL as unknown as { createObjectURL?: unknown }).createObjectURL !== 'function') {
  let counter = 0;
  Object.assign(URL, {
    createObjectURL: () => `blob:musicrate/${(counter += 1)}`,
    revokeObjectURL: () => undefined,
  });
}
