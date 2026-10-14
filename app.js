require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');

const app = express();

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
        return;
    }

    console.log('Connected to MySQL');
});

function validateStudent(body) {
    const errors = [];
    const { student_id, first_name, last_name, course, year_level, email } = body;

    if (!student_id || !student_id.trim()) errors.push('Student ID is required.');
    if (!first_name || !first_name.trim()) errors.push('First name is required.');
    if (!last_name || !last_name.trim()) errors.push('Last name is required.');
    if (!course || !course.trim()) errors.push('Course is required.');

    const year = Number(year_level);
    if (!Number.isInteger(year) || year < 1 || year > 5) {
        errors.push('Year level must be a whole number from 1 to 5.');
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailPattern.test(email.trim())) {
        errors.push('A valid email address is required.');
    }

    return errors;
}

app.set('view engine', 'ejs');

app.use(express.urlencoded({ extended: true }));

app.use(express.static('public'));


app.get('/', (req, res) => {
    db.query('SELECT * FROM students ORDER BY id DESC', (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database error');
        }
        res.render('index', {
            students: results
        });
    });
});

app.post('/students/delete/:id', (req, res) => {

    const sql = 'DELETE FROM students WHERE id = ?';

    db.query(sql, [req.params.id], (err) => {

        if (err) {
            console.error(err);
            return res.status(500).send('Unable to delete student');
        }

        res.redirect('/');
    });
});

app.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});
app.get('/students/add', (req, res) => {
    res.render('add', { errors: [], student: {} });
});

app.post('/students/add', (req, res) => {

    const errors = validateStudent(req.body);
    if (errors.length > 0) {
        return res.status(400).render('add', { errors, student: req.body });
    }

    const { student_id, first_name, last_name, course, year_level, email } = req.body;

    const sql = `
        INSERT INTO students
        (student_id, first_name, last_name, course, year_level, email)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    const values = [
        student_id.trim(), first_name.trim(), last_name.trim(),
        course.trim(), Number(year_level), email.trim()
    ];

    db.query(sql, values, (err) => {

        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).render('add', {
                    errors: ['That Student ID already exists.'],
                    student: req.body
                });
            }
            console.error(err);
            return res.status(500).send('Unable to save student');
        }

        res.redirect('/');
    });
});

app.get('/students/edit/:id', (req, res) => {

    db.query('SELECT * FROM students WHERE id = ?', [req.params.id], (err, results) => {

        if (err) {
            console.error(err);
            return res.status(500).send('Database error');
        }

        if (results.length === 0) {
            return res.status(404).send('Student not found');
        }

        res.render('edit', { errors: [], student: results[0] });
    });
});

app.post('/students/edit/:id', (req, res) => {

    const errors = validateStudent(req.body);
    if (errors.length > 0) {
        return res.status(400).render('edit', {
            errors,
            student: { ...req.body, id: req.params.id }
        });
    }

    const { student_id, first_name, last_name, course, year_level, email } = req.body;

    const sql = `
        UPDATE students
        SET student_id = ?, first_name = ?, last_name = ?,
            course = ?, year_level = ?, email = ?
        WHERE id = ?
    `;

    const values = [
        student_id.trim(), first_name.trim(), last_name.trim(),
        course.trim(), Number(year_level), email.trim(), req.params.id
    ];

    db.query(sql, values, (err) => {

        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).render('edit', {
                    errors: ['That Student ID already belongs to another student.'],
                    student: { ...req.body, id: req.params.id }
                });
            }
            console.error(err);
            return res.status(500).send('Unable to update student');
        }

        res.redirect('/');
    });
});

app.get('/students/search', (req, res) => {
    const keyword = req.query.keyword || '';
    const sql = `
        SELECT * FROM students
        WHERE student_id LIKE ?
        OR first_name LIKE ?
        OR last_name LIKE ?
        OR course LIKE ?
    `;
    const searchValue = `%${keyword}%`;
    db.query(
        sql,
        [
            searchValue,
            searchValue,
            searchValue,
            searchValue
        ],
        (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Search error');
            }
            res.render('index', {
                students: results
            });
        }
    );
});