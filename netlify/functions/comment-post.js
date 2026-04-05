const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  try {
    // 验证登录
    const authHeader = event.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: '请先登录' }) };
    }

    const token = authHeader.substring(7);
    let decoded;
    
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: '登录已过期，请重新登录' }) };
    }

    const { content, postId, parentId } = JSON.parse(event.body);
    
    if (!content?.trim() || !postId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: '评论内容不能为空' }) };
    }

    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    await client.db('comments').collection('comments').insertOne({
      postId,
      content: content.trim(),
      authorId: new ObjectId(decoded.userId),
      authorName: decoded.username,
      authorAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(decoded.username)}`,
      parentId: parentId ? new ObjectId(parentId) : null,
      createdAt: new Date(),
      likes: 0,
      status: 'active'
    });

    await client.close();

    return { statusCode: 201, headers, body: JSON.stringify({ success: true }) };

  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return { statusCode: 401, headers, body: JSON.stringify({ error: '登录无效' }) };
    }
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
