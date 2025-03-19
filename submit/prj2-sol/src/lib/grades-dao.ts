import * as mongo from 'mongodb';

import { Grades, Types as T, Errors as E} from './prj1-sol/main.js';
import { Err, Result } from "./prj1-sol/lib/errors.js";

interface SectionDoc {
  _id: T.SectionId;
  info: T.SectionInfo;
  enrolledStudents: T.StudentId[];
  scores: Record<T.StudentId, Record<T.ColId, T.Score>>;
}

export const database_error = ( preceding: string, error: Error ) : Result<any, Err>=> E.errResult(E.Err.err( error.message, 'DB' ) );

export class GradesDao {

  private client: mongo.MongoClient;
  private students: mongo.Collection<T.Student & { _id: T.StudentId }>;
  private sections: mongo.Collection<SectionDoc>;

  private constructor(client: mongo.MongoClient, students: mongo.Collection<T.Student & { _id: T.StudentId }>, sections: mongo.Collection<SectionDoc>) {
    this.client = client;
    this.students = students;
    this.sections = sections;
  }

  //static factory function; should do all async operations like
  //getting a connection and creating indexing.  Finally, it
  //should use the constructor to return an instance of this class.
  //returns error code DB on database errors.
  static async make( dbUrl: string )
    : Promise<E.Result<GradesDao, E.Err>> {

    try {
      const client = await mongo.MongoClient.connect(dbUrl)
      const database = client.db()
      const students = database.collection<T.Student & { _id: T.StudentId }>('students')
      const sections = database.collection<SectionDoc>('sections')

      return E.okResult( new GradesDao( client, students, sections ) )
    }
    catch ( error ) {
      return database_error('Connection', error as Error );
    }
  }

  async close(): Promise<E.Result<void, E.Err>> {
    try {
      await this.client.close();
      return E.okResult(undefined);
    } catch ( error ) {
      return database_error('Close', error as Error );
    }
  }

  async clear(): Promise<E.Result<undefined, E.Err>> {
    try {
      await this.students.deleteMany({});
      await this.sections.deleteMany({});
      return E.okResult(undefined);
    } catch ( error ) {
      return database_error('Clear', error as Error );
    }
  }

  async add_student( student: T.Student ): Promise<E.Result<void, E.Err>> {
    try {
      await this.students.insertOne({ ...student, _id: student.id });
      return E.okResult(undefined);
    } catch ( error ) {
      return database_error('Add Student', error as Error );
    }
  }

  async get_student( studentId: T.StudentId ): Promise<E.Result<T.Student, E.Err>> {
    try {
      const student = await this.students.findOne({ _id: studentId });
      if (!student) {
        return E.errResult(E.Err.err('DB', `NOT_FOUND`));
      }
      return E.okResult({ ...student, id: student._id });
    } catch ( error ) {
      return database_error('Get Student', error as Error );
    }
  }

  async get_students(): Promise<E.Result<T.Student[], E.Err>> {
    try {
      const students = await this.students.find().toArray();
      return E.okResult(students.map(student => ({ id: student._id, firstName: student.firstName, lastName: student.lastName })));
    } catch ( error ) {
      return database_error('Get All Students', error as Error );
    }
  }

  async add_section_info( sectionInfo: T.SectionInfo ): Promise<E.Result<void, E.Err>> {
    try {
      const sectionDoc: SectionDoc = {
        _id: sectionInfo.id,
        info: sectionInfo,
        enrolledStudents: [],
        scores: {}
      };
      await this.sections.insertOne(sectionDoc);
      return E.okResult(undefined);
    } catch ( error ) {
      return database_error('Add Section Info', error as Error );
    }
  }

  async get_section( section_id: T.SectionId ): Promise<E.Result<T.SectionInfo, E.Err>> {
    try {
      const sectionDoc = await this.sections.findOne({ _id: section_id });
      if (!sectionDoc) {
        return E.errResult(E.Err.err('DB', `Section ${section_id} not found`));
      }
      return E.okResult(sectionDoc.info);
    } catch ( error ) {
      return database_error('Get Section', error as Error );
    }
  }

  async enroll_student( section_id: T.SectionId, student_id: T.StudentId ): Promise<E.Result<void, E.Err>> {
    try {
      const sectionDoc = await this.sections.findOne({ _id: section_id });
      if ( !sectionDoc ) {
        return E.errResult(E.Err.err('DB', `Section ${section_id} not found`));
      }
      if ( !sectionDoc.enrolledStudents.includes( student_id ) ) {
        sectionDoc.enrolledStudents.push(student_id);
        await this.sections.updateOne({ _id: section_id }, { $set: { enrolledStudents: sectionDoc.enrolledStudents } });
      }
      return E.okResult(undefined);
    } catch ( error ) {
      return database_error('Enroll Student', error as Error );
    }
  }

  async add_score( section_id: T.SectionId, student_id: T.StudentId, col_id: T.ColId, score: T.Score ): Promise<E.Result<void, E.Err>> {
    try {
      const updateKey = `scores.${student_id}.${col_id}`;
      const result = await this.sections.updateOne(
          { _id: section_id },
          { $set: { [updateKey]: score } }
      );
      return result.matchedCount > 0
          ? E.okResult(undefined)
          : E.errResult(E.Err.err(`Section ${section_id} not found`, 'NOT_FOUND'));
    } catch ( error ) {
      return database_error('Add Score', error as Error );
    }
  }

  async get_sections(): Promise<E.Result<SectionDoc[], E.Err>> {
    try {
      const sections = await this.sections.find().toArray();
      return E.okResult( sections );
    } catch ( error ) {
      return database_error('Get Sections', error as Error );
    }
  }

  async remove_section( section_id: T.SectionId ): Promise<E.Result<void, E.Err>> {
    try {
      const result = await this.sections.deleteOne({ _id: section_id });
      return result.deletedCount > 0
          ? E.okResult(undefined)
          : E.errResult(E.Err.err(`Section ${section_id} not found`, 'NOT_FOUND'));
    } catch ( error ) {
      return database_error('Remove Section', error as Error );
    }
  }





} //GradesDao

// TODO: add private functions, types, data as needed
  
