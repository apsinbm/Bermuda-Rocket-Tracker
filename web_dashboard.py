#!/usr/bin/env python3
"""
WEB DASHBOARD FOR BERMUDA GROCERY PRICE MONITOR
Real-time web interface for business users
"""

from flask import Flask, render_template, jsonify, request
import sqlite3
import json
from datetime import datetime, timedelta
import pandas as pd
import plotly.graph_objs as go
import plotly.utils

app = Flask(__name__)

class PriceDashboard:
    def __init__(self):
        self.db_path = "/Users/pato/production_scraper.db"
    
    def get_db_connection(self):
        """Get database connection"""
        return sqlite3.connect(self.db_path)
    
    def get_store_stats(self):
        """Get store performance statistics"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT store, COUNT(*) as total_products, 
                   AVG(current_price) as avg_price,
                   MIN(current_price) as min_price,
                   MAX(current_price) as max_price
            FROM products 
            WHERE current_price IS NOT NULL
            GROUP BY store
        ''')
        
        stats = cursor.fetchall()
        conn.close()
        
        return [
            {
                'store': row[0],
                'total_products': row[1],
                'avg_price': round(row[2], 2) if row[2] else 0,
                'min_price': round(row[3], 2) if row[3] else 0,
                'max_price': round(row[4], 2) if row[4] else 0
            }
            for row in stats
        ]
    
    def get_price_comparison(self, product_name=None):
        """Get price comparison data"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        if product_name:
            cursor.execute('''
                SELECT product_name, store, current_price, product_title, last_scraped
                FROM products 
                WHERE product_name = ? AND current_price IS NOT NULL
                ORDER BY current_price ASC
            ''', (product_name,))
        else:
            cursor.execute('''
                SELECT product_name, store, current_price, product_title, last_scraped
                FROM products 
                WHERE current_price IS NOT NULL
                ORDER BY product_name, current_price ASC
                LIMIT 100
            ''')
        
        results = cursor.fetchall()
        conn.close()
        
        return [
            {
                'product_name': row[0],
                'store': row[1],
                'current_price': round(row[2], 2),
                'product_title': row[3],
                'last_scraped': row[4]
            }
            for row in results
        ]
    
    def get_recent_changes(self, limit=20):
        """Get recent price changes"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT product_name, store, previous_price, current_price, 
                   price_change_percent, last_scraped
            FROM products 
            WHERE previous_price IS NOT NULL 
            AND ABS(price_change_percent) > 1
            ORDER BY last_scraped DESC
            LIMIT ?
        ''', (limit,))
        
        results = cursor.fetchall()
        conn.close()
        
        return [
            {
                'product_name': row[0],
                'store': row[1],
                'previous_price': round(row[2], 2),
                'current_price': round(row[3], 2),
                'price_change_percent': round(row[4], 1),
                'last_scraped': row[5]
            }
            for row in results
        ]
    
    def get_scraping_sessions(self, limit=10):
        """Get recent scraping sessions"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT session_start, session_end, urls_processed, 
                   urls_successful, success_rate, status
            FROM scraping_sessions 
            ORDER BY session_start DESC
            LIMIT ?
        ''', (limit,))
        
        results = cursor.fetchall()
        conn.close()
        
        return [
            {
                'session_start': row[0],
                'session_end': row[1],
                'urls_processed': row[2],
                'urls_successful': row[3],
                'success_rate': round(row[4], 1) if row[4] else 0,
                'status': row[5]
            }
            for row in results
        ]
    
    def get_price_trends(self, product_name, days=30):
        """Get price trends for a product"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT p.store, ph.price, ph.timestamp
            FROM products p
            JOIN price_history ph ON p.id = ph.product_id
            WHERE p.product_name = ?
            AND ph.timestamp >= datetime('now', '-{} days')
            ORDER BY ph.timestamp
        '''.format(days), (product_name,))
        
        results = cursor.fetchall()
        conn.close()
        
        return [
            {
                'store': row[0],
                'price': round(row[1], 2),
                'timestamp': row[2]
            }
            for row in results
        ]

dashboard = PriceDashboard()

@app.route('/')
def index():
    """Main dashboard page"""
    return render_template('dashboard.html')

@app.route('/api/stores')
def api_stores():
    """API endpoint for store statistics"""
    return jsonify(dashboard.get_store_stats())

@app.route('/api/products')
def api_products():
    """API endpoint for product prices"""
    product_name = request.args.get('product')
    return jsonify(dashboard.get_price_comparison(product_name))

@app.route('/api/changes')
def api_changes():
    """API endpoint for recent price changes"""
    limit = int(request.args.get('limit', 20))
    return jsonify(dashboard.get_recent_changes(limit))

@app.route('/api/sessions')
def api_sessions():
    """API endpoint for scraping sessions"""
    limit = int(request.args.get('limit', 10))
    return jsonify(dashboard.get_scraping_sessions(limit))

@app.route('/api/trends/<product_name>')
def api_trends(product_name):
    """API endpoint for price trends"""
    days = int(request.args.get('days', 30))
    return jsonify(dashboard.get_price_trends(product_name, days))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)