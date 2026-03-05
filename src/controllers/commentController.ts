import { Request, Response } from 'express';
import { Task } from '../models/Task';

export const getRecentComments = async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.query;

    const pipeline = [
      { $unwind: { path: '$comments', preserveNullAndEmptyArrays: true } },
      { $match: { 'comments._id': { $exists: true } } },
      { $sort: { 'comments.createdAt': -1 } },
      { $limit: parseInt(limit as string) },
      {
        $lookup: {
          from: 'users',
          localField: 'comments.author',
          foreignField: '_id',
          as: 'comments.authorObj'
        }
      },
      {
        $addFields: {
          'comments.author': { $arrayElemAt: ['$comments.authorObj', 0] }
        }
      },
      {
        $lookup: {
          from: 'users',
          let: { replyAuthors: '$comments.replies.author' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ['$_id', '$$replyAuthors']
                }
              }
            }
          ],
          as: 'replyAuthorObjs'
        }
      },
      {
        $addFields: {
          'comments.replies': {
            $map: {
              input: '$comments.replies',
              as: 'reply',
              in: {
                $mergeObjects: [
                  '$$reply',
                  {
                    author: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: '$replyAuthorObjs',
                            cond: { $eq: ['$$this._id', '$$reply.author'] }
                          }
                        },
                        0
                      ]
                    }
                  }
                ]
              }
            }
          }
        }
      },
      {
        $project: {
          taskId: '$_id',
          taskTitle: '$title',
          comment: '$comments',
          _id: 0
        }
      }
    ];

    const recentComments = await Task.aggregate(pipeline);

    res.json(recentComments);
  } catch (error: any) {
    console.error('Recent comments error:', error);
    res.status(500).json({ error: error.message });
  }
};
