import React from 'react';

interface TeamMember {
  name: string;
  role: string;
  bio: string;
  isFounder?: boolean;
}

const teamMembers: TeamMember[] = [
  {
    name: 'M.I. NOSIF',
    role: 'Founder & Lead Developer',
    bio: 'Leads the development and overall direction of the project.',
    isFounder: true,
  },
  {
    name: 'Khalid A.',
    role: 'Software Engineer',
    bio: 'Worked on core system implementation.',
  },
  {
    name: 'A. Emmanuel'
    role: 'Cloud Engineer and Backend Developer'
    bio: 'Responsible for backend systems and cloud security
  },
];

const Team: React.FC = () => {
  const founder = teamMembers[0];
  const members = teamMembers.slice(1);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Our Team
          </h1>
          <p className="text-lg text-slate-600">
            Meet the talented people behind our project
          </p>
        </div>

        {/* Founder Section */}
        <div className="mb-20">
          <div className="flex justify-center">
            <div className="w-full max-w-md">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-400 rounded-2xl blur-lg opacity-25 group-hover:opacity-40 transition-opacity duration-300" />
                <div className="relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-shadow duration-300">
                  <div className="mb-4">
                    <span className="inline-block bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs font-bold px-4 py-1.5 rounded-full">
                      FOUNDER
                    </span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
                    {founder.name}
                  </h2>
                  <p className="text-blue-600 font-semibold text-lg mb-4">
                    {founder.role}
                  </p>
                  <p className="text-slate-600 text-base leading-relaxed">
                    {founder.bio}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Team Members Section */}
        <div>
          <h3 className="text-2xl font-bold text-slate-900 mb-8 text-center">
            Team Members
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {members.map((member, index) => (
              <div
                key={index}
                className="group"
              >
                <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-shadow duration-300 h-full">
                  <h3 className="text-xl font-bold text-slate-900 mb-1">
                    {member.name}
                  </h3>
                  <p className="text-slate-500 font-medium text-sm mb-4 inline-block border-l-2 border-blue-600 pl-3">
                    {member.role}
                  </p>
                  <p className="text-slate-600 text-base leading-relaxed">
                    {member.bio}
                  </p>
                  <div className="mt-4 h-1 w-12 bg-gradient-to-r from-blue-600 to-blue-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Team;
