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

	const { avatarStyle, customAvatarUrl } = JSON.parse(event.body);
	
	if (!avatarStyle && !customAvatarUrl) {
	  return { statusCode: 400, headers, body: JSON.stringify({ error: '请选择头像样式或提供头像URL' }) };
	}

	const client = new MongoClient(process.env.MONGODB_URI);
	await client.connect();
	
	const users = client.db('comments').collection('users');
	
	// 获取用户信息以生成新头像
	const user = await users.findOne({ _id: new ObjectId(decoded.userId) });
	if (!user) {
	  await client.close();
	  return { statusCode: 404, headers, body: JSON.stringify({ error: '用户不存在' }) };
	}

	let newAvatar;
	if (customAvatarUrl) {
	  // 基础校验：必须是 http/https 开头
	  if (!/^https?:\/\/.+/i.test(customAvatarUrl)) {
		await client.close();
		return { statusCode: 400, headers, body: JSON.stringify({ error: '头像URL格式错误' }) };
	  }
	  newAvatar = customAvatarUrl;
	} else {
	  // 使用dicebear生成新头像
	  const styles = ['avataaars', 'bottts', 'identicon', 'micah', 'open-peeps', 'lorelei', 'fun-emoji', 'thumbs', 'pixel-art'];
	  const style = avatarStyle || styles[Math.floor(Math.random() * styles.length)];
	  newAvatar = `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(user.username)}&backgroundColor=b6e3f4`;
	}

	await users.updateOne(
	  { _id: new ObjectId(decoded.userId) },
	  { $set: { 
		avatar: newAvatar,
		avatarStyle: avatarStyle || 'custom',
		updatedAt: new Date()
	  }}
	);

	// 同时更新该用户所有评论的头像（可选，保持一致性）
	const comments = client.db('comments').collection('comments');
	await comments.updateMany(
	  { authorId: new ObjectId(decoded.userId) },
	  { $set: { authorAvatar: newAvatar } }
	);

	await client.close();

	return { 
	  statusCode: 200, 
	  headers, 
	  body: JSON.stringify({ 
		success: true, 
		avatar: newAvatar,
		message: '头像更新成功' 
	  }) 
	};

  } catch (err) {
	return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};