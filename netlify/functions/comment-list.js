const { MongoClient, ObjectId } = require('mongodb');

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
    
    const comments = client.db('comments').collection('comments');
    
    // 获取顶级评论
    const topComments = await comments
      .find({ postId, parentId: null, status: 'active' })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    // 获取回复
    const topIds = topComments.map(c => new ObjectId(c._id));
    const replies = await comments
      .find({ parentId: { $in: topIds }, status: 'active' })
      .sort({ createdAt: 1 })
      .toArray();

    // 组装树形结构
    const result = topComments.map(c => ({
      ...c,
      replies: replies.filter(r => r.parentId?.toString() === c._id.toString())
    }));

    await client.close();

    return { statusCode: 200, headers, body: JSON.stringify({ comments: result }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
