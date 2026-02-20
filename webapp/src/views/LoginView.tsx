import React from 'react';
import RegisterForm from '../RegisterForm';

type Props = {
  onNext: () => void;
};

const LoginView: React.FC<Props> = ({ onNext }) => {
  return (
    <div className="app">
      <h2>Registro / Login</h2>
      <section className="panel">
        <RegisterForm />
        <div style={{ marginTop: 12 }}>
          <button type="button" onClick={onNext} className="submit-button">
            Continuar
          </button>
        </div>
      </section>
    </div>
  );
};

export default LoginView;
