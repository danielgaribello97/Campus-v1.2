import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StudentApp } from './apps/student/StudentApp';
import { AdminAuthGuard } from './apps/cafeteria/AdminAuthGuard';
import { ensureSeedData } from './firebase/seed';
import { testConnection } from './firebase/config';

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await testConnection();
        await ensureSeedData(false);
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setIsInitialized(true);
      }
    };
    init();
  }, []);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-stone-700 font-bold text-sm">Iniciando CampusBite...</p>
        <p className="text-stone-400 text-xs mt-1">Conectando con la base de datos central</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta Raíz: ÚNICAMENTE la vista del Estudiante, sin enlaces hacia la administración */}
        <Route path="/" element={<StudentApp />} />

        {/* Ruta de Administración: ÚNICAMENTE la App de la Cafetería, protegida con PIN de seguridad */}
        <Route path="/admin" element={<AdminAuthGuard />} />

        {/* Redirección por defecto */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
