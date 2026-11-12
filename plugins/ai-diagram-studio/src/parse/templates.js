/**
 * Conservative domain templates. They are used only when the user supplied
 * several recognizable entities but no relationship statements or foreign
 * keys at all. Every application is disclosed as an assumption.
 */
function present(builder, aliases) {
  return aliases.some(alias => builder.resolve(alias))
}

export const diagrams = [
  {
    id: 'library',
    matches(builder) {
      const groups = [
        ['anggota', 'member', 'members', 'pengguna', 'user', 'users'],
        ['buku', 'book', 'books'],
        ['peminjaman', 'loan', 'loans', 'borrowing', 'borrowings'],
        ['pengembalian', 'return', 'returns', 'pengembalian_buku'],
        ['denda', 'fine', 'fines', 'penalty', 'penalties'],
      ]
      return groups.filter(group => present(builder, group)).length >= 3
    },
    assumption: 'No relationship rules were stated, so a conventional library-domain template was applied (member/book loans, returns, and fines). Review the inferred relationships before using this as a database design.',
    relations: [
      { source: ['anggota', 'member', 'members', 'pengguna', 'user', 'users'], target: ['peminjaman', 'loan', 'loans', 'borrowing', 'borrowings'], sourceCardinality: 'one', targetCardinality: 'many', foreignKey: true, sourceSynthetic: true },
      { source: ['buku', 'book', 'books'], target: ['peminjaman', 'loan', 'loans', 'borrowing', 'borrowings'], sourceCardinality: 'one', targetCardinality: 'many', foreignKey: true, sourceSynthetic: true },
      { source: ['peminjaman', 'loan', 'loans', 'borrowing', 'borrowings'], target: ['pengembalian', 'return', 'returns'], sourceCardinality: 'one', targetCardinality: 'one', foreignKey: true, unique: true },
      { source: ['peminjaman', 'loan', 'loans', 'borrowing', 'borrowings'], target: ['denda', 'fine', 'fines', 'penalty', 'penalties'], sourceCardinality: 'one', targetCardinality: 'many', foreignKey: true, sourceSynthetic: true },
    ],
  },
  {
    id: 'ecommerce',
    matches(builder) {
      const groups = [
        ['pelanggan', 'customer', 'customers', 'pembeli', 'buyer', 'buyers'],
        ['pesanan', 'order', 'orders'],
        ['produk', 'product', 'products', 'barang', 'item', 'items'],
        ['pembayaran', 'payment', 'payments', 'transaksi', 'transaction', 'transactions'],
        ['order_item', 'order_items', 'orderitem', 'orderitems', 'detail_pesanan'],
      ]
      return groups.filter(group => present(builder, group)).length >= 3
    },
    assumption: 'No relationship rules were stated, so a conventional commerce-domain template was applied. Review the inferred relationships before using this as a database design.',
    relations: [
      { source: ['pelanggan', 'customer', 'customers', 'pembeli', 'buyer', 'buyers'], target: ['pesanan', 'order', 'orders'], sourceCardinality: 'one', targetCardinality: 'many', foreignKey: true, sourceSynthetic: true },
      { source: ['pesanan', 'order', 'orders'], target: ['order_item', 'order_items', 'orderitem', 'orderitems', 'detail_pesanan'], sourceCardinality: 'one', targetCardinality: 'many', foreignKey: true, sourceSynthetic: true },
      { source: ['produk', 'product', 'products', 'barang', 'item', 'items'], target: ['order_item', 'order_items', 'orderitem', 'orderitems', 'detail_pesanan'], sourceCardinality: 'one', targetCardinality: 'many', foreignKey: true, sourceSynthetic: true },
      { source: ['pesanan', 'order', 'orders'], target: ['pembayaran', 'payment', 'payments', 'transaksi', 'transaction', 'transactions'], sourceCardinality: 'one', targetCardinality: 'many', foreignKey: true, sourceSynthetic: true },
    ],
  },
]
