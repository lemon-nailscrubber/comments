// /.netlify/functions/comment-like.js
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
	return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const headers = {
	'Access-Control-Allow-Origin': '*',
	'Content-Type': 'application/json'
  };

  const token = event.headers.authorization?.replace('Bearer ', '');
  if (!token) {
	return { statusCode: 401, headers, body: JSON.stringify({ error: '未登录' }) };
  }

  try {
	const decoded = jwt.verify(token, process.env.JWT_SECRET);
	const userId = decoded.userId;

	const { commentId } = JSON.parse(event.body);
	if (!commentId) {
	  return { statusCode: 400, headers, body: JSON.stringify({ error: '缺少评论ID' }) };
	}

	const client = new MongoClient(process.env.MONGODB_URI);
	await client.connect();
	const db = client.db('comments');
	// 确保点赞唯一索引存在（重复执行不会报错）
	try {
	  await db.collection('likes').createIndex(
		{ commentId: 1, userId: 1 }, 
		{ unique: true }
	  );
	} catch (e) {
	  // 索引已存在或其他错误，忽略
	}

	// 利用唯一索引原子插入，防止并发重复点赞
	try {
	  await db.collection('likes').insertOne({
		commentId: commentId,
		userId: userId.toString(),
		createdAt: new Date()
	  });
	} catch (e) {
	  await client.close();
	  if (e.code === 11000) {
		return { statusCode: 400, headers, body: JSON.stringify({ error: '已经点赞过了' }) };
	  }
	  throw e;
	}
	
	// 更新评论的点赞数
	const updateResult = await db.collection('comments').updateOne(
	  { _id: new ObjectId(commentId), status: 'approved' },
	  { $inc: { likes: 1 } }
	);

	if (updateResult.matchedCount === 0) {
	  await client.close();
	  return { statusCode: 400, headers, body: JSON.stringify({ error: '评论不存在或未通过审核' }) };
	}
	
		// 获取更新后的点赞数
		const comment = await db.collection('comments').findOne(
		  { _id: new ObjectId(commentId) },
		  { projection: { likes: 1 } }
		);
	
	await client.close();

	return {
	  statusCode: 200,
	  headers,
	  body: JSON.stringify({ 
		success: true, 
		likes: comment.likes 
	  })
	};

  } catch (err) {
	return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};