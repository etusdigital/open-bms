export function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timeoutID: null | ReturnType<typeof setTimeout> = null;

  return function (this: any, ...args: any[]) {
    if (timeoutID) {
      clearTimeout(timeoutID);
    }

    timeoutID = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  } as T;
}
