export const CatchPromise = async function (promise: any) {
  try {
    const response = await promise;
    return [null, response];
  } catch (err) {
    return [err, null];
  }
};

export const CatchPromiseWithType = async function <T>(promise: Promise<T>) {
  const [err, response] = await CatchPromise(promise);
  return [err, response] as [any, T | null];
};
