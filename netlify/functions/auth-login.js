const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
    const { email, password } = JSON.parse(event.body);
    
    if (!email || !password) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: '请填写邮箱和密码' }) };
    }

    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const user = await client.db('comments').collection('users').findOne({ email });
    
    if (!user || !await bcrypt.compare(password, user.password)) {
      await client.close();
      return { statusCode: 401, headers, body: JSON.stringify({ error: '邮箱或密码错误' }) };
    }

    const token = jwt.sign(
      { userId: user._id.toString(), username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    await client.close();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        token,
        user: {
          id: user._id,
          name: user.username,
          email: user.email,
          avatar: user.avatar
        }
      })
    };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
