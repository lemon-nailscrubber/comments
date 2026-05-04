// /.netlify/functions/comment-list.js
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
	return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const headers = {
	'Access-Control-Allow-Origin': '*',
	'Content-Type': 'application/json'
  };

  try {
	const { postId } = event.queryStringParameters;
	
	if (!postId) {
	  return { statusCode: 400, headers, body: JSON.stringify({ error: '缺少文章ID' }) };
	}

	const client = new MongoClient(process.env.MONGODB_URI);
	await client.connect();
	
	const db = client.db('comments');
	const comments = db.collection('comments');

	// 获取当前用户已点赞的评论列表
	let likedComments = [];
	const token = event.headers.authorization?.replace('Bearer ', '');
	if (token) {
	  try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		const userId = decoded.userId;
		
		const likes = await db.collection('likes')
		  .find({ userId: userId.toString() })
		  .project({ commentId: 1 })
		  .toArray();
		
		likedComments = likes.map(l => l.commentId.toString());
	  } catch (e) {
		// token 无效，忽略
	  }
	}

	// 获取顶级评论
	const topComments = await comments
	  .find({ postId, parentId: null, status: 'approved' })
	  .sort({ createdAt: -1 })
	  .limit(50)
	  .toArray();

	// 获取回复
	const topIds = topComments.map(c => c._id);
	const replies = await comments
	  .find({ parentId: { $in: topIds }, status: 'approved' })
	  .sort({ createdAt: 1 })
	  .toArray();

	// 组装树形结构
	const result = topComments.map(c => ({
	  ...c,
	  replies: replies.filter(r => r.parentId?.toString() === c._id.toString())
	}));

	await client.close();

	return { 
	  statusCode: 200, 
	  headers, 
	  body: JSON.stringify({ 
		comments: result,
		likedComments: likedComments 
	  }) 
	};

  } catch (err) {
	return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};