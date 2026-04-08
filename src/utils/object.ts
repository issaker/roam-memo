/**
 * Object Utilities
 *
 * deepClone: JSON-based deep clone for simple serializable objects.
 * Not suitable for objects with functions, Dates, or circular references.
 */
export const deepClone = (obj: object) => {
  return JSON.parse(JSON.stringify(obj));
};
