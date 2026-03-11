import React from 'react';
import { FaCalendarAlt, FaVideo, FaUserCheck } from 'react-icons/fa';

const Interviews = () => {
    return (
        <div className="hr-page-content">
            <h1><FaCalendarAlt /> Interviews</h1>
            <p>Coordinate interview schedules, interviewer assignments, and candidate progression in one timeline.</p>

            <div className="hr-page-cards">
                <article>
                    <h3><FaVideo /> Scheduling clarity</h3>
                    <p>
                        Manage interview type, location, and meeting links for smooth candidate and interviewer experiences.
                    </p>
                </article>
                <article>
                    <h3><FaUserCheck /> Hiring outcomes</h3>
                    <p>
                        Capture ratings and recommendations after each interview to support faster, better hiring decisions.
                    </p>
                </article>
            </div>
        </div>
    );
};

export default Interviews;
