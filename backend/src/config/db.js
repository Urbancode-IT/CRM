const mongoose = require('mongoose');

// Reuse the connection across warm serverless invocations (Vercel).
let cached = global.__tuitionMongoose;
if (!cached) {
  cached = global.__tuitionMongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn;

  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tuition';
  mongoose.set('strictQuery', true);

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri).then((conn) => {
      console.log(`[db] connected`);
      return conn;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = connectDB;
