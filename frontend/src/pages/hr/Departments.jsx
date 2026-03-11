import React from 'react';
import { FaBuilding, FaUsers, FaSitemap } from 'react-icons/fa';

const Departments = () => {
    return (
        <div className="hr-page-content">
            <h1><FaBuilding /> Departments</h1>
            <p>Organize teams, assign leaders, and monitor each department’s health from one place.</p>

            <div className="hr-page-cards">
                <article>
                    <h3><FaSitemap /> Department structure</h3>
                    <p>
                        Build parent-child department hierarchies, define ownership, and keep your org chart accurate.
                    </p>
                </article>
                <article>
                    <h3><FaUsers /> Team visibility</h3>
                    <p>
                        Track manager assignments and staffing needs so HR can support hiring and workforce planning.
                    </p>
                </article>
            </div>
        </div>
    );
};

export default Departments;
