import os

filepath = r'c:\Users\Acer\Desktop\pr\litronics\public\purchase.js'
content = open(filepath, 'r', encoding='utf-8').read()

changes = 0

# 1. Add Del. Type header
old1 = '<th>Placed By</th>\r\n            <th>Date</th>'
new1 = '<th>Placed By</th>\r\n            <th>Del. Type</th>\r\n            <th>Date</th>'
if old1 in content:
    content = content.replace(old1, new1, 1)
    changes += 1
    print("1. Added Del. Type header")

# 2. Add delivery_type to group object
old2 = 'delivery_date: item.delivery_date,\r\n                supplier_name: item.supplier_name,'
new2 = 'delivery_date: item.delivery_date,\r\n                delivery_type: item.delivery_type,\r\n                supplier_name: item.supplier_name,'
if old2 in content:
    content = content.replace(old2, new2, 1)
    changes += 1
    print("2. Added delivery_type to group")

# 3. Add delivery type row + dynamic currency before the date column
old3 = "const date = group.order_date ? new Date(group.order_date).toLocaleDateString('en-IN') : '-';\r\n\r\n        tr.innerHTML = `"
new3 = """const date = group.order_date ? new Date(group.order_date).toLocaleDateString('en-IN') : '-';\r\n        const delType = group.delivery_type ? group.delivery_type.charAt(0).toUpperCase() + group.delivery_type.slice(1) : '-';\r\n        let currSym = '\\u20b9';\r\n        if (group.price_currency === 'USD') currSym = '$';\r\n        if (group.price_currency === 'RMB') currSym = '\\u00a5';\r\n\r\n        tr.innerHTML = `"""
if old3 in content:
    content = content.replace(old3, new3, 1)
    changes += 1
    print("3. Added delType + currSym vars")

# 4. Add delType column and fix date column in row
old4 = '<td>${group.order_placed_by}</td>\r\n            <td>${date}</td>'
new4 = '<td>${group.order_placed_by}</td>\r\n            <td>${delType}</td>\r\n            <td>${date}</td>'
if old4 in content:
    content = content.replace(old4, new4, 1)
    changes += 1
    print("4. Added delType column in row")

# 5. Fix currency symbol in total value
old5 = "₹${group.total_value.toLocaleString"
new5 = "${currSym}${group.total_value.toLocaleString"
if old5 in content:
    content = content.replace(old5, new5, 1)
    changes += 1
    print("5. Fixed currency symbol")

# 6. Update colspan for empty state
old6 = 'colspan="8"'
new6 = 'colspan="9"'
if old6 in content:
    content = content.replace(old6, new6, 1)
    changes += 1
    print("6. Updated colspan")

open(filepath, 'w', encoding='utf-8').write(content)
print(f"\nDone! Applied {changes} changes.")
