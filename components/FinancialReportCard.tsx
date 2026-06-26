import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface FinancialReportData {
    period: string;
    totalIncome: number;
    totalExpense: number;
    balance: number;
    categoryBreakdown: { name: string; value: number }[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const FinancialReportCard: React.FC<{ data: FinancialReportData }> = ({ data }) => {
    if (!data) return null;
    const totalIncome = data.totalIncome || 0;
    const totalExpense = data.totalExpense || 0;
    const balance = data.balance || 0;
    const { categoryBreakdown, period } = data;

    const barData = [
        { name: 'Receitas', value: totalIncome, fill: '#22c55e' },
        { name: 'Despesas', value: totalExpense, fill: '#ef4444' },
    ];

    return (
        <div className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl p-4 my-2 shadow-md w-full max-w-md mx-auto">
            <div className="flex justify-between items-center mb-4 border-b border-[var(--border-color)] pb-2">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Balanço: {period}</h3>
                <span className={`text-sm font-bold px-2 py-1 rounded ${balance >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {balance >= 0 ? '+' : ''} R$ {balance.toFixed(2)}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-[var(--bg-primary)] p-3 rounded-lg text-center">
                    <p className="text-xs text-[var(--text-secondary)] uppercase">Receitas</p>
                    <p className="text-green-400 font-bold text-lg">R$ {totalIncome.toFixed(2)}</p>
                </div>
                <div className="bg-[var(--bg-primary)] p-3 rounded-lg text-center">
                    <p className="text-xs text-[var(--text-secondary)] uppercase">Despesas</p>
                    <p className="text-red-400 font-bold text-lg">R$ {totalExpense.toFixed(2)}</p>
                </div>
            </div>

            {/* Income vs Expense Bar Chart */}
            <div className="h-40 w-full mb-6">
                <p className="text-xs text-[var(--text-secondary)] mb-2 text-center">Fluxo de Caixa</p>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={60} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f3f4f6' }}
                            itemStyle={{ color: '#f3f4f6' }}
                            formatter={(value: number) => [`R$ ${(value || 0).toFixed(2)}`, 'Valor']}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                            {barData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Expense Breakdown Pie Chart */}
            {categoryBreakdown && categoryBreakdown.length > 0 && (
                <div className="h-64 w-full">
                    <p className="text-xs text-[var(--text-secondary)] mb-2 text-center">Despesas por Categoria</p>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={categoryBreakdown}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={70}
                                fill="#8884d8"
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {categoryBreakdown.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f3f4f6' }}
                                itemStyle={{ color: '#f3f4f6' }}
                                formatter={(value: number) => [`R$ ${(value || 0).toFixed(2)}`, 'Valor']}
                            />
                            <Legend 
                                layout="horizontal" 
                                verticalAlign="bottom" 
                                align="center"
                                wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            )}
            
            {(!categoryBreakdown || categoryBreakdown.length === 0) && totalExpense > 0 && (
                <p className="text-center text-xs text-[var(--text-secondary)]">Sem detalhes de categoria.</p>
            )}
        </div>
    );
};

export default FinancialReportCard;
