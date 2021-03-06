const express = require("express");
const router = express.Router();
const Category = require('../models/category');
const Cafeteria = require('../models/cafeteria');
const Rating = require('../models/rating');
const checkToken = require('./authentication');

// get rating of single restaurant's whole menu
router.get('/wholemenu', (req, res) => {
    const { name } = req.query;
    Category.aggregate([
        {
            '$match': {
                'name': name
            }
        },
        {
            '$unwind': '$menus'
        },
        {
            '$lookup': {
                'from': 'ratings',
                'localField': 'menus',
                'foreignField': 'menu',
                'as': 'ratings'
            }
        },
        {
            '$project': {
                'ratings': {
                    '$arrayElemAt': ['$ratings', 0]
                }
            }
        },
        {
            '$project': {
                'name': '$ratings.name',
                'menu': '$ratings.menu',
                'ratings': '$ratings.rating'
            }
        }
    ], (err, result) => {
        if (err) res.status(500).end('DB error');

        const processed = result.reduce((acc, cur) => {
            const key = cur.menu
            delete cur.menu

            acc[key] = {...cur}

            return acc
        }, {})

        res.send(processed)
    })
})

// add star rating to menu
router.put('/restaurant', checkToken, (req, res) => {
    const { name, rating } = req.body;

    Cafeteria.findOneAndUpdate(
        {
            'name': name
        },
        {
            '$push': {
                'rating': rating
            }
        },
        (err, result) => {
            if (err) res.status(500).end('DB error');

            res.sendStatus(200);
        }
    )
})

// add star rating to menu
router.put('/menu', checkToken, (req, res) => {
    const { name, menu, starPointsObj } = req.body;

    Rating.findOneAndUpdate(
        {
            'name': name,
            'menu': menu
        },
        {
            '$push': {
                'rating': starPointsObj
            }
        },
        (err, result) => {
            if (err) res.status(500).end('DB error');

            res.sendStatus(200);
        }
    )
})

// get recommended restaruant for specific user
router.get('/recommended', checkToken, (req, res) => {
    let preference = req.query;

    const sum = Object.keys(preference).reduce((acc, cur) => acc + Number(preference[cur]), 0);

    Object.keys(preference).map(key => { preference[key] = Number(preference[key]) / sum; return null; });

    Rating.aggregate([
        {
            '$unwind': '$rating'
        },
        {
            '$group': {
                '_id': {
                    'name': '$name',
                    'menu': '$menu'
                },
                'avgTaste': {
                    '$avg': '$rating.taste'
                },
                'avgPortion': {
                    '$avg': '$rating.portion'
                },
                'avgPrice': {
                    '$avg': '$rating.price'
                }
            }
        },
        {
            '$project': {
                'name': '$_id.name',
                'menu': '$_id.menu',
                'recommended': {
                    '$add': [
                        {
                            '$multiply': ['$avgTaste', preference.taste]
                        },
                        {
                            '$multiply': ['$avgPortion', preference.portion]
                        },
                        {
                            '$multiply': ['$avgPrice', preference.price]
                        }
                    ]
                },
                'rating': {
                    'taste': '$avgTaste',
                    'portion': '$avgPortion',
                    'price': '$avgPrice'
                }
            }
        },
        {
            '$sort': {
                'recommended': -1
            }
        },
        {
            '$limit': 20
        }
    ], (err, result) => {
        if (err) res.status(500).end('DB error');

        res.send(result);
    })
})

module.exports = router;
