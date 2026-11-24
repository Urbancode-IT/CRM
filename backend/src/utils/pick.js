function pick(obj, keys) {
  const out = {};
  keys.forEach((key) => {
    if (obj[key] !== undefined) out[key] = obj[key];
  });
  return out;
}

module.exports = pick;
