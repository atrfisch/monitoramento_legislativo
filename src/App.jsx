import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

function App() {
  const [propositionCodesInput, setPropositionCodesInput] = useState('');
  const [selectedPropositions, setSelectedPropositions] = useState([]);
  const [latestMovements, setLatestMovements] = useState([]);
  const [propositionsByChanges, setPropositionsByChanges] = useState([]);
  const [currentStatusData, setCurrentStatusData] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [weeklyMovementData, setWeeklyMovementData] = useState([]);

  const API_BASE_URL = 'https://dadosabertos.camara.leg.br/api/v2';

  // Helper function to get the start of the week (Sunday) for a given date
  const getWeekStart = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDay(); // 0 for Sunday, 1 for Monday, etc.
    const diff = date.getDate() - day; // Adjust to Sunday
    const sunday = new Date(date.setDate(diff));
    return sunday.toISOString().split('T')[0]; // Return in YYYY-MM-DD format
  };

  // Function to parse proposition code (e.g., "PL 123/2023")
  const parsePropositionCode = (code) => {
    const parts = code.match(/([A-Z]+)\s*(\d+)\/(\d{4})/i);
    if (parts && parts.length === 4) {
      return {
        siglaTipo: parts[1].toUpperCase(),
        numero: parseInt(parts[2], 10),
        ano: parseInt(parts[3], 10),
      };
    }
    return null;
  };

  // Function to fetch proposition ID from its type, number, and year
  const fetchPropositionId = async (siglaTipo, numero, ano) => {
    try {
      const url = `${API_BASE_URL}/proposicoes?siglaTipo=${siglaTipo}&numero=${numero}&ano=${ano}&ordem=ASC&ordenarPor=id`;
      console.log(`Fetching proposition ID from: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`API Error - Status: ${response.status}, Status Text: ${response.statusText}`);
        let errorBody = 'No response body';
        try {
          const errorJson = await response.json();
          errorBody = JSON.stringify(errorJson);
        } catch (jsonError) {
          errorBody = await response.text();
        }
        throw new Error(`Erro ao buscar ID da proposição: ${response.status} - ${response.statusText || 'Erro desconhecido'}. Detalhes: ${errorBody}`);
      }
      const data = await response.json();
      if (data.dados && data.dados.length > 0) {
        return data.dados[0].id;
      }
      return null;
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('Erro de rede: Não foi possível conectar à API da Câmara dos Deputados. Verifique sua conexão com a internet ou tente novamente mais tarde.');
      }
      console.error('Erro ao buscar ID da proposição:', error);
      throw new Error(`Erro ao buscar ID da proposição: ${error.message}`);
    }
  };

  // Function to fetch proposition details by ID
  const fetchPropositionDetails = async (id) => {
    try {
      const url = `${API_BASE_URL}/proposicoes/${id}`;
      console.log(`Fetching proposition details from: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`API Error - Status: ${response.status}, Status Text: ${response.statusText}`);
        let errorBody = 'No response body';
        try {
          const errorJson = await response.json();
          errorBody = JSON.stringify(errorJson);
        } catch (jsonError) {
          errorBody = await response.text();
        }
        throw new Error(`Erro ao buscar detalhes da proposição: ${response.status} - ${response.statusText || 'Erro desconhecido'}. Detalhes: ${errorBody}`);
      }
      const data = await response.json();
      return data.dados;
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('Erro de rede: Não foi possível conectar à API da Câmara dos Deputados. Verifique sua conexão com a internet ou tente novamente mais tarde.');
      }
      console.error('Erro ao buscar detalhes da proposição:', error);
      throw new Error(`Erro ao buscar detalhes da proposição: ${error.message}`);
    }
  };

  // Function to fetch proposition movements (tramitações) by ID
  const fetchPropositionMovements = async (id) => {
    try {
      const url = `${API_BASE_URL}/proposicoes/${id}/tramitacoes`;
      console.log(`Fetching proposition movements from: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`API Error - Status: ${response.status}, Status Text: ${response.statusText}`);
        let errorBody = 'No response body';
        try {
          const errorJson = await response.json();
          errorBody = JSON.stringify(errorJson);
        } catch (jsonError) {
          errorBody = await response.text();
        }
        throw new Error(`Erro ao buscar andamentos da proposição: ${response.status} - ${response.statusText || 'Erro desconhecido'}. Detalhes: ${errorBody}`);
      }
      const data = await response.json();
      return data.dados;
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('Erro de rede: Não foi possível conectar à API da Câmara dos Deputados. Verifique sua conexão com a internet ou tente novamente mais tarde.');
      }
      console.error('Erro ao buscar andamentos da proposição:', error);
      throw new Error(`Erro ao buscar andamentos da proposição: ${error.message}`);
    }
  };

  // Effect to process data whenever selectedPropositions changes
  useEffect(() => {
    if (selectedPropositions.length === 0) {
      setLatestMovements([]);
      setPropositionsByChanges([]);
      setCurrentStatusData([]);
      setWeeklyMovementData([]);
      return;
    }

    // 1) Lista dos últimos andamentos ordenados do mais recente para o mais antigo
    const allMovements = selectedPropositions.flatMap(prop =>
      prop.andamentos.map(mov => ({
        data: mov.dataHora.split('T')[0],
        descricao: mov.descricaoTipo || mov.descricaoSituacao || 'Andamento não especificado',
        codigo: prop.codigo,
        titulo: prop.titulo,
      }))
    );
    const sortedMovements = allMovements.sort((a, b) => new Date(b.data) - new Date(a.data));
    setLatestMovements(sortedMovements.slice(0, 10)); // Limit to the last 10 movements

    // 2) Lista de proposições com mais alterações da que teve mais alterações para a menos
    const propositionsWithChangeCount = selectedPropositions.map(prop => ({
      codigo: prop.codigo,
      titulo: prop.titulo,
      numChanges: prop.andamentos.length,
    }));
    const sortedPropositionsByChanges = propositionsWithChangeCount.sort((a, b) => b.numChanges - a.numChanges);
    setPropositionsByChanges(sortedPropositionsByChanges);

    // 3) Status Atual da Proposição
    const statusData = selectedPropositions.map(prop => {
      const status = prop.statusProposicao;
      const situacao = status?.descricaoSituacao || status?.nomeSituacao || 'Não informado';
      const despacho = status?.despacho ? `Despacho: ${status.despacho}` : '';
      const dataStatus = status?.dataHora ? `Data: ${status.dataHora.split('T')[0]}` : '';
      const orgao = status?.nomeOrgao ? `Órgão: ${status.nomeOrgao}` : '';

      return {
        codigo: prop.codigo,
        titulo: prop.titulo,
        situacao: situacao,
        despacho: despacho,
        dataStatus: dataStatus,
        orgao: orgao,
      };
    });
    setCurrentStatusData(statusData);

    // Prepare data for weekly movement chart
    const weeklyCounts = {};
    const allDates = new Set();

    selectedPropositions.forEach(prop => {
      prop.andamentos.forEach(mov => {
        const weekStart = getWeekStart(mov.dataHora);
        allDates.add(weekStart);

        if (!weeklyCounts[weekStart]) {
          weeklyCounts[weekStart] = {};
        }
        if (!weeklyCounts[weekStart][prop.codigo]) {
          weeklyCounts[weekStart][prop.codigo] = 0;
        }
        weeklyCounts[weekStart][prop.codigo]++;
      });
    });

    const sortedDates = Array.from(allDates).sort();

    const chartData = sortedDates.map(date => {
      const dataPoint = { name: date };
      selectedPropositions.forEach(prop => {
        dataPoint[prop.codigo] = weeklyCounts[date]?.[prop.codigo] || 0;
      });
      return dataPoint;
    });

    setWeeklyMovementData(chartData);

  }, [selectedPropositions]);

  // Generate a consistent color for each proposition code for the chart
  const getPropositionColor = (code) => {
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      hash = code.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i++) {
      const value = (hash >> (i * 8)) & 0xFF;
      color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
  };

  // Handle input change and filter propositions
  const handleProcessPropositions = async () => {
    setIsLoading(true);
    setErrorMessage('');
    setSelectedPropositions([]);
    setWeeklyMovementData([]);
    setCurrentStatusData([]);

    const codes = propositionCodesInput.split(',').map(code => code.trim()).filter(code => code !== '');
    if (codes.length === 0) {
      setErrorMessage('Por favor, insira pelo menos um código de proposição.');
      setIsLoading(false);
      return;
    }

    const fetchedPropositions = [];
    const notFoundCodes = [];

    for (const code of codes) {
      const parsedCode = parsePropositionCode(code);
      if (!parsedCode) {
        notFoundCodes.push(code);
        continue;
      }

      try { // Added try-catch around fetchPropositionId and subsequent fetches
        const propositionId = await fetchPropositionId(parsedCode.siglaTipo, parsedCode.numero, parsedCode.ano);

        if (propositionId) {
          const details = await fetchPropositionDetails(propositionId);
          const movements = await fetchPropositionMovements(propositionId);

          if (details) {
            fetchedPropositions.push({
              codigo: code,
              titulo: details.ementa || details.nome || 'Título não disponível',
              andamentos: movements,
              autores: details.autores || [],
              statusProposicao: details.statusProposicao || null,
            });
          } else {
            notFoundCodes.push(code);
          }
        } else {
          notFoundCodes.push(code);
        }
      } catch (error) {
        // Catch errors from fetch functions and add to notFoundCodes
        console.error(`Erro ao processar proposição ${code}:`, error.message);
        notFoundCodes.push(`${code} (Erro: ${error.message})`);
      }
    }

    setSelectedPropositions(fetchedPropositions);

    if (notFoundCodes.length > 0) {
      setErrorMessage(`Não foi possível encontrar ou processar as seguintes proposições: ${notFoundCodes.join(', ')}. Verifique os códigos e tente novamente. Isso pode ser devido a problemas de rede ou dados não disponíveis na API.`);
    } else if (fetchedPropositions.length === 0) {
      setErrorMessage('Nenhuma proposição encontrada para os códigos informados.');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 font-sans flex flex-col items-center">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          body {
            font-family: 'Inter', sans-serif;
          }
        `}
      </style>
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-4xl mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">Monitoramento Legislativo</h1>

        <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:space-x-4"> {/* Adjusted for horizontal layout */}
          <div className="flex-grow mb-4 sm:mb-0"> {/* Flex-grow to make textarea take available space */}
            <label htmlFor="proposition-codes" className="block text-gray-700 text-sm font-medium mb-2">
              Códigos das Proposições (separados por vírgula):
            </label>
            <textarea
              id="proposition-codes"
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 ease-in-out"
              rows="4"
              value={propositionCodesInput}
              onChange={(e) => setPropositionCodesInput(e.target.value)}
              placeholder="Ex: PL 123/2023, PEC 45/2022, MP 789/2024"
            ></textarea>
            {errorMessage && (
              <p className="text-red-500 text-sm mt-2">{errorMessage}</p>
            )}
          </div>
          <button
            onClick={handleProcessPropositions}
            className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-md hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-200 ease-in-out shadow-md"
            disabled={isLoading}
          >
            {isLoading ? 'Processando...' : 'Processar Proposições'}
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="text-center text-gray-700 text-lg mt-4">Carregando dados...</div>
      )}

      {!isLoading && selectedPropositions.length > 0 && (
        <>
          {/* Nova Seção: Quantidade de Movimentação por Semana (Gráfico de Linha) */}
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-4xl mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Quantidade de Movimentação por Semana</h2>
            {weeklyMovementData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={weeklyMovementData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {selectedPropositions.map((prop) => (
                    <Line
                      key={prop.codigo}
                      type="monotone"
                      dataKey={prop.codigo}
                      stroke={getPropositionColor(prop.codigo)}
                      activeDot={{ r: 8 }}
                      name={prop.codigo} // Display proposition code in legend
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500">Nenhum dado de movimentação semanal disponível para as proposições selecionadas.</p>
            )}
          </div>

          <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Últimos Andamentos */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Últimos Andamentos</h2>
              {latestMovements.length > 0 ? (
                <ul className="space-y-3">
                  {latestMovements.map((mov, index) => (
                    <li key={index} className="border-b border-gray-200 pb-3 last:border-b-0">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">{mov.data}</span> - <span className="font-semibold">{mov.codigo}</span>: {mov.descricao}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">Nenhum andamento encontrado para as proposições selecionadas.</p>
              )}
            </div>

            {/* Proposições com Mais Alterações */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Proposições com Mais Alterações</h2>
              {propositionsByChanges.length > 0 ? (
                <ul className="space-y-3">
                  {propositionsByChanges.map((prop, index) => (
                    <li key={index} className="border-b border-gray-200 pb-3 last:border-b-0">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">{prop.numChanges} alterações</span> - <span className="font-semibold">{prop.codigo}</span>: {prop.titulo}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">Nenhuma proposição encontrada com alterações.</p>
              )}
            </div>

            {/* Status Atual */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Status Atual</h2>
              {currentStatusData.length > 0 ? (
                <ul className="space-y-4">
                  {currentStatusData.map((prop, index) => (
                    <li key={index} className="border-b border-gray-200 pb-4 last:border-b-0">
                      <p className="text-base font-semibold text-gray-700 mb-1">
                        {prop.codigo}: {prop.titulo}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Situação:</span> {prop.situacao}
                      </p>
                      {prop.despacho && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Despacho:</span> {prop.despacho}
                        </p>
                      )}
                      {prop.dataStatus && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Data do Status:</span> {prop.dataStatus}
                        </p>
                      )}
                      {prop.orgao && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Órgão:</span> {prop.orgao}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">Nenhum status atual encontrado para as proposições selecionadas.</p>
            )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
