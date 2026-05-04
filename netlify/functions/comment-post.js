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
	const authHeader = event.headers.authorization;
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
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
	const trimmed = content?.trim();
	if (!trimmed || !postId) {
	  return { statusCode: 400, headers, body: JSON.stringify({ error: '评论内容不能为空' }) };
	}
	if (trimmed.length > 5000) {
	  return { statusCode: 400, headers, body: JSON.stringify({ error: '评论内容不能超过5000字' }) };
	}

	const client = new MongoClient(process.env.MONGODB_URI);
	await client.connect();
	
	// 获取用户最新信息（确保头像是最新的）
	const users = client.db('comments').collection('users');
	const user = await users.findOne({ _id: new ObjectId(decoded.userId) });
	
	if (!user) {
	  await client.close();
	  return { statusCode: 404, headers, body: JSON.stringify({ error: '用户不存在' }) };
	}

await client.db('comments').collection('comments').insertOne({
  postId,
  content: content.trim(),
  authorId: new ObjectId(decoded.userId),
  authorName: decoded.username,
  authorAvatar: user.avatar,
  parentId: parentId ? new ObjectId(parentId) : null,
  createdAt: new Date(),
  likes: 0,
  status: 'pending'  // 新评论默认待审核
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