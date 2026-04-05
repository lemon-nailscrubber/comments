const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const { username, email, password } = JSON.parse(event.body);
    
    if (!username || !email || !password || password.length < 6) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: '信息不完整或密码太短（至少6位）' }) };
    }

    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const users = client.db('comments').collection('users');
    
    const existing = await users.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      await client.close();
      return { statusCode: 409, headers, body: JSON.stringify({ error: '用户名或邮箱已被注册' }) };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`;

    await users.insertOne({
      username,
      email,
      password: hashedPassword,
      avatar,
      createdAt: new Date(),
      role: 'user'
    });

    await client.close();

    return { statusCode: 201, headers, body: JSON.stringify({ success: true, message: '注册成功' }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};